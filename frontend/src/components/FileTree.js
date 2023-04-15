import React, {useEffect, useState} from 'react'
import {Alert, Snackbar} from "@mui/material"
import TreeView from '@mui/lab/TreeView'
import {TreeItem} from "@mui/lab"
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

function FileTree (props) {
    const [files, setFiles] = useState([])
    const [filesError, setFilesError] = useState(false)
    const [filesErrorMessage, setFilesErrorMessage] = useState('')

    const getFiles = async (signal) => {
        const headers = {
            Accepted: 'application/json'
        }
        const response = await fetch('/api/workspaces/' + props.workspaceName + '/branches/' + props.branchName + '/files', {
            method: 'GET',
            headers,
            signal
        })
        if (!response.ok) {
            throw new Error(JSON.stringify(response))
        }
        const responseData = await response.json()
        const loadedFiles = []
        for (const key in responseData) {
            loadedFiles.push({
                name: responseData[key].name
            })
        }
        setFiles(loadedFiles)
        return loadedFiles
    }

    useEffect(() => {
        if (props.trigger) {
            getFiles()
                .then((loadedFiles) => {
                    setFilesError(false)
                    props.handleLoadFiles(loadedFiles)
                })
                .catch((err) => {
                    console.log('Error while retrieving the Workspace files: ' + err.message)
                    setFilesError(true)
                    setFilesErrorMessage('Cannot retrieve the Workspace files, please refresh the page.')
                })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.trigger])

    return (
        <div>
            <TreeView
                aria-label="file system navigator"
                defaultCollapseIcon={<ExpandMoreIcon />}
                defaultExpandIcon={<ChevronRightIcon />}
                sx={{ flexGrow: 1, maxWidth: 400, position: 'relative', alignItems: 'left', align: 'left', userSelect: 'none'}}
            >
                {files.map(file =>
                    <TreeItem key={file.name} nodeId={file.name} label={file.name} onClick={() => props.handleSelectFile(file.name)} sx={{ textAlign: 'left' }} />
                )}
            </TreeView>
            <Snackbar
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right'
                }}
                open={filesError}
                key={'errorMessage'}
                autoHideDuration={5000}
                onClose={() => setFilesError(false)}
            >
                <Alert severity="error" sx={{ width: '100%' }}>
                    {filesErrorMessage}
                </Alert>
            </Snackbar>
        </div>
    )
}

export default FileTree
