import React, {useState, useEffect} from 'react'
import {Gitgraph, templateExtend, TemplateName} from "@gitgraph/react";

function GitGraph (props) {
    const [gitGraphLoading, setGitGraphLoading] = useState(false)
    const [loadComplete, setLoadComplete] = useState(false)

    const options = {
        template: templateExtend(TemplateName.Metro, {
            branch: {
                showLabel: true,
                labelFont: "normal 12pt Arial"
            },
            commit: {
                dot: {
                    size: 10,
                    strokeWidth: 3
                },
                tag: {
                    font: "normal 12pt Arial"
                },
                message: {
                    displayAuthor: false,
                    displayHash: true,
                    font: "normal 13pt Arial"
                }
            }
        })
    }

    const configureBranchDependencies = (branchName) => {
        let parentCommits = []
        const branchLogs = props.logs.filter(logs => logs.branch_name === branchName)
        for (const key in branchLogs) {
            const commit = branchLogs[key].commit_uuid
            const nextKey = parseInt(key) + 1
            if (branchLogs.length > nextKey) {
                const parentCommit = branchLogs[nextKey].commit_uuid
                parentCommits.push({
                    branchName: branchLogs[key].branch_name,
                    commitUuid: commit,
                    message: branchLogs[key].message,
                    parentCommit: parentCommit
                })
            } else {
                parentCommits.push({
                    branchName: branchLogs[key].branch_name,
                    commitUuid: commit,
                    message: branchLogs[key].message,
                    parentCommit: undefined
                })
            }
        }
        return parentCommits
    }

    const cleanupParentCommits = (parentCommits, previousCommit, previousBranchName) => {
        const entriesSameBranch = parentCommits.filter(entry => ((entry.branchName === previousBranchName) && (entry.parentCommit === previousCommit.commitUuid)))
        if (entriesSameBranch.length !== 0) {
            const entrySameBranch = entriesSameBranch[0]
            const entriesOtherBranch = parentCommits.filter(entry => ((entry.branchName !== previousBranchName) && (entry.commitUuid === entrySameBranch.commitUuid)))
            if (entriesOtherBranch.length !== 0) {
                for (const key in entriesOtherBranch) {
                    const entryOtherBranch = entriesOtherBranch[key]
                    const index = parentCommits.indexOf(entryOtherBranch)
                    parentCommits = [...parentCommits.slice(0, index), ...parentCommits.slice(index + 1)]
                }
            }
            parentCommits = cleanupParentCommits(parentCommits, entrySameBranch, entrySameBranch.branchName)
        }
        const entriesNewBranch = parentCommits.filter(entry => ((entry.branchName !== previousBranchName) && (entry.parentCommit === previousCommit.commitUuid)))
        if (entriesNewBranch.length !== 0) {
            const entryNewBranch = entriesNewBranch[0]
            const entriesOtherBranch = parentCommits.filter(entry => ((entry.branchName !== previousBranchName) && (entry.commitUuid === entryNewBranch.commitUuid)) && (entry.branchName !== entryNewBranch.branchName))
            if (entriesOtherBranch.length !== 0) {
                for (const key in entriesOtherBranch) {
                    const entryOtherBranch = entriesOtherBranch[key]
                    const index = parentCommits.indexOf(entryOtherBranch)
                    parentCommits = [...parentCommits.slice(0, index), ...parentCommits.slice(index + 1)]
                }
            }
            parentCommits = cleanupParentCommits(parentCommits, entryNewBranch, entryNewBranch.branchName)
        }
        return parentCommits
    }

    const applyNextGitGraph = (parentCommits, previousCommit, previousBranchName, previousBranch, gitGraph) => {
        const entriesNewBranch = parentCommits.filter(entry => ((entry.branchName !== previousBranchName) && (entry.parentCommit === previousCommit.commitUuid)))
        if (entriesNewBranch.length !== 0) {
            const entryNewBranch = entriesNewBranch[0]
            const newBranch = gitGraph.branch(entryNewBranch.branchName)
            const index = parentCommits.indexOf(entryNewBranch)
            parentCommits = [...parentCommits.slice(0, index), ...parentCommits.slice(index + 1)]
            const commitNewBranch = newBranch.commit({
                hash: entryNewBranch.commitUuid,
                subject: entryNewBranch.message,
                onMessageClick(commit) {
                    props.handleSelectWorkspaceBranch(commit.branches[0])
                },
            })
            applyNextGitGraph(parentCommits, entryNewBranch, entryNewBranch.branchName, commitNewBranch, gitGraph)
        }

        const entriesSameBranch = parentCommits.filter(entry => ((entry.branchName === previousBranchName) && (entry.parentCommit === previousCommit.commitUuid)))
        if (entriesSameBranch.length !== 0) {
            const entrySameBranch = entriesSameBranch[0]
            const index = parentCommits.indexOf(entrySameBranch)
            parentCommits = [...parentCommits.slice(0, index), ...parentCommits.slice(index + 1)]
            const commitSameBranch = previousBranch.commit({
                hash: entrySameBranch.commitUuid,
                subject: entrySameBranch.message,
                onMessageClick(commit) {
                    props.handleSelectWorkspaceBranch(commit.branches[0])
                },
            })
            applyNextGitGraph(parentCommits, entrySameBranch, entrySameBranch.branchName, commitSameBranch, gitGraph)
        }
    }

    const handleGitGraph = (gitGraph) => {
        if (gitGraphLoading === false) {
            setGitGraphLoading(true)
        } else {
            return
        }
        let parentCommits = []
        for (const key in props.branches) {
            parentCommits = [...parentCommits, ...configureBranchDependencies(props.branches[key].name)]
        }
        // Assume that the first item is the master branch
        const rootCommit = parentCommits.filter(entry => entry.branchName === "master" && entry.parentCommit === undefined)
        if (rootCommit.length !== 0) {
            parentCommits = cleanupParentCommits(parentCommits, rootCommit[0], "master")
            const masterBranch = gitGraph.branch("master")
            const masterBranchFirstCommit = masterBranch.commit({
                 hash: rootCommit[0].commitUuid,
                 subject: rootCommit[0].message,
                onMessageClick(commit) {
                    props.handleSelectWorkspaceBranch(commit.branches[0])
                },
             })
            const rootCommits = parentCommits.filter(entry => entry.branchName === "master" && entry.parentCommit === undefined)
            const index = parentCommits.indexOf(rootCommits[0])
            parentCommits = [...parentCommits.slice(0, index), ...parentCommits.slice(index + 1)]
            const entriesOtherBranch = parentCommits.filter(entry => ((entry.branchName !== "master") && (entry.commitUuid === rootCommits[0].commitUuid)))
            if (entriesOtherBranch.length !== 0) {
                for (const key in entriesOtherBranch) {
                    const entryOtherBranch = entriesOtherBranch[key]
                    const index = parentCommits.indexOf(entryOtherBranch)
                    parentCommits = [...parentCommits.slice(0, index), ...parentCommits.slice(index + 1)]
                }
            }
            applyNextGitGraph(parentCommits, rootCommits[0], "master", masterBranchFirstCommit, gitGraph)
        }
        setGitGraphLoading(false)
        setLoadComplete(true)
    }

    useEffect(() => {
        setTimeout(() => {
            if (loadComplete === false) {
                return
            }
            const gitgraph = document.getElementById("gitgraph")
            const svg = gitgraph.getElementsByTagName('svg')[0];
            svg.addEventListener("mouseover",  (e) => svg.style.cursor = 'default');
            const elements = Array.from(svg.getElementsByTagName('text'));
            elements.forEach(function(el) {
                el.addEventListener("mouseover",  (e) => el.style.cursor = 'pointer');
            })
        }, 1000);
    }, [loadComplete])

    return (
        <div id="gitgraph" style={{userSelect: 'none'}}>
            <Gitgraph options={options}>{(gitGraph) => handleGitGraph(gitGraph)}</Gitgraph>
        </div>
    )
}

export default GitGraph
