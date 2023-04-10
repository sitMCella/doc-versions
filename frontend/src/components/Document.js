import React, {useEffect, useRef, useState} from 'react'
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Drawer,
    List,
    MenuItem,
    Select,
    Snackbar,
    Stack,
    TextField,
    Typography
} from "@mui/material"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import Workspace from "./Workspace";
import GitGraph from "./GitGraph";
import FileTree from "./FileTree";
import FileEditor from "./FileEditor";

function useStateRef(initialValue) {
    const [value, setValue] = useState(initialValue);

    const ref = useRef(value);

    useEffect(() => {
        ref.current = value;
    }, [value]);

    return [value, setValue, ref];
}

function Document () {
    const [workspaces, setWorkspaces] = useState([])
    const [workspaceError, setWorkspaceError] = useState(false)
    const [workspaceErrorMessage, setWorkspaceErrorMessage] = useState('')
    const [workspaceLoaded, setWorkspaceLoaded] = useState(false)
    const [branches, setBranches] = useState([])
    const [logs, setLogs] = useState([])
    const [workspaceName, setWorkspaceName] = useState('')
    const [branchesAccordionExpanded, setBranchesAccordionExpanded] = useState(false)
    const [triggerGitGraph, setTriggerGitGraph] = useState(false)
    const [branch, setBranch] = useState('')
    const [branchLoaded, setBranchLoaded] = useState(false)
    const [trigger, setTrigger] = useState(0)
    const [file, setFile] = useState('')
    const [triggerFile, setTriggerFile] = useState(0)
    const [directoryAccordionExpanded, setDirectoryAccordionExpanded] = useState(false)
    const [openNewWorkspaceDialog, setOpenNewWorkspaceDialog] = useState(false)
    const [newWorkspaceName, setNewWorkspaceName] = useState('')
    const [openNewFileDialog, setOpenNewFileDialog] = useState(false)
    const [files, setFiles] = useState([])
    const [isNewFile, setIsNewFile] = useState(false)
    const [newFileName, setNewFileName] = useState('')
    const [fileExtension, setFileExtension] = useState('txt')
    const [newFileErrorMessage, setNewFileErrorMessage] = useState('')

    const defaultDrawerWidth = 500
    const minDrawerWidth = 50
    const maxDrawerWidth = 1000

    const [drawerWidth, setDrawerWidth, ref] = useStateRef(defaultDrawerWidth)
    let isResizing = useRef(0)
    const [cursor, setCursor, refCursor] = useStateRef('default')

    const handleMouseDown = (e) => {
        if (e.clientX > ref.current-20 && e.clientX < ref.current+20) {
            isResizing.current = 1
        }
    }

    const handleMouseUp = () => {
        isResizing.current = 0
    }

    const handleMouseMove = (e) => {
        if (e.clientX > ref.current-20 && e.clientX < ref.current+20) {
            setCursor('default')
        } else {
            setCursor('ew-resize')
        }
        if(isResizing.current === 0) {
            return
        }
        const newWidth = e.clientX - document.body.offsetLeft;
        if (newWidth > minDrawerWidth && newWidth < maxDrawerWidth) {
            setDrawerWidth(newWidth)
        }
    }

    const getWorkspaces = async (signal) => {
        const headers = {
            Accepted: 'application/json'
        }
        const response = await fetch('/api/workspaces', {
            method: 'GET',
            headers: headers,
            signal
        })
        if (!response.ok) {
            throw new Error(JSON.stringify(response))
        }
        const responseData = await response.json()
        const loadedWorkspaces = []
        for (const key in responseData) {
            loadedWorkspaces.push({
                name: responseData[key]
            })
        }
        setWorkspaces(loadedWorkspaces)
    }

    const reloadWorkspaceLogs = () => {
        setWorkspaceLoaded(false)
        setBranchLoaded(false)
        setBranch('')
        setCursor('default')
        setTriggerGitGraph(false)
    }

    const updateWorkspaceLogs = (workspaceName, workspaceBranches, workspaceLogs) => {
        setCursor('default')
        setWorkspaceName(workspaceName)
        setBranches(workspaceBranches)
        setLogs(workspaceLogs)
        setBranchesAccordionExpanded(true)
        setWorkspaceLoaded(true)
    }

    const selectWorkspaceBranch = (branchName) => {
        setCursor('default')
        setBranch(branchName)
        setDirectoryAccordionExpanded(true)
        setBranchLoaded(true)
        setTrigger((trigger) => trigger + 1)
        setFile('')
        setTriggerFile((triggerFile) => triggerFile + 1)
    }

    const loadFiles = (loadedFiles) => {
        setFiles(loadedFiles)
    }

    const selectFile = (fileName) => {
        setIsNewFile(false)
        setFile(fileName)
        setTriggerFile((triggerFile) => triggerFile + 1)
    }

    const updateBranchesAccordionExpanded = () => {
        setBranchesAccordionExpanded(!branchesAccordionExpanded)
        setCursor('default')
    }

    const updateDirectoryAccordionExpanded = () => {
        setDirectoryAccordionExpanded(!directoryAccordionExpanded)
        setCursor('default')
    }

    useEffect(() => {
        const controller = new AbortController()
        const signal = controller.signal
        document.addEventListener('mousemove', e => handleMouseMove(e))
        document.addEventListener('mouseup', e => handleMouseUp(e))
        document.addEventListener('mousedown', e => handleMouseDown(e))
        document.title = 'Document Versions';
        getWorkspaces(signal)
            .then(() => setWorkspaceError(false))
            .catch((err) => {
                console.log('Error while retrieving the Workspaces: ' + err.message)
                setWorkspaceError(true)
                setWorkspaceErrorMessage('Cannot retrieve the Workspaces, please refresh the page.')
            })
        return () => controller.abort()
    }, [])

    const handleNewWorkspaceClick = () => {
        setOpenNewWorkspaceDialog(true)
    }

    const handleCloseNewWorkspaceDialog = () => {
        setOpenNewWorkspaceDialog(false)
    }

    const createWorkspace = async () => {
        const headers = {
            Accepted: 'application/json'
        }
        const response = await fetch('/api/workspaces/' + newWorkspaceName, {
            method: 'POST',
            headers: headers
        })
        if (!response.ok) {
            throw new Error(JSON.stringify(response))
        }
    }

    const handleNewWorkspace = () => {
        createWorkspace()
            .then((b) => {
                const newWorkspaces = [...workspaces, {name: newWorkspaceName}]
                setWorkspaces(newWorkspaces)
                setOpenNewWorkspaceDialog(false)
            })
            .catch((err) => {
                console.log('Error while creating the Workspace: ' + err.message)
                setOpenNewWorkspaceDialog(false)
                setWorkspaceError(true)
                setWorkspaceErrorMessage('Cannot create the Workspace, please refresh the page.')
            })
    }

    const deleteWorkspace = (workspaceNameToDelete) => {
        const newWorkspaces = workspaces.filter((workspace) => workspace.name !== workspaceNameToDelete)
        setWorkspaces(newWorkspaces)
    }

    const handleNewFileClick = () => {
        setOpenNewFileDialog(true)
        setNewFileErrorMessage('')
    }

    const handleCloseNewFileDialog = () => {
        setOpenNewFileDialog(false)
        setNewFileErrorMessage('')
    }

    const handleFileExtensionChange = (e) => {
        setFileExtension(e.target.value)
    }

    const handleNewFile = () => {
        const fileName = newFileName + '.' + fileExtension
        if (fileName.indexOf(' ') >= 0) {
            setNewFileErrorMessage('The file name should not contain spaces')
            return
        }
        const fileExists = files.filter(file => file.name === fileName)
        if (fileExists.length > 0) {
            setNewFileErrorMessage('The file ' + fileName + ' already exists')
            return
        }
        setIsNewFile(true)
        setFile(fileName)
        setTriggerFile((triggerFile) => triggerFile + 1)
        setOpenNewFileDialog(false)
    }

    const fileEvent = (resetFileEditor) => {
        setTrigger((trigger) => trigger + 1)
        setTriggerGitGraph(true)
        if(resetFileEditor === true) {
            setFile('')
            setTriggerFile((triggerFile) => triggerFile + 1)
        }
    }

    return (
        <div>
            <Box sx={{ display: 'flex' }}>
                <Drawer
                    PaperProps={{ style: {width: ref.current, cursor: refCursor.current} }}
                    variant="permanent"
                    anchor="left"
                >
                    <Divider />
                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="panel1a-content" id="workspaces-panel">
                            <Typography>Workspaces</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <List>
                                {workspaces.map(workspace =>
                                    <Workspace trigger={triggerGitGraph && workspaceName === workspace.name} name={workspace.name} handleReloadWorkspaceLogs={reloadWorkspaceLogs} handleWorkspaceLogs={updateWorkspaceLogs} handleDeleteWorkspace={deleteWorkspace} />
                                )}
                            </List>
                            <Stack direction="row">
                                <Button onClick={handleNewWorkspaceClick}>New Workspace</Button>
                            </Stack>
                        </AccordionDetails>
                    </Accordion>
                    <Divider />
                    <Accordion expanded={branchesAccordionExpanded}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="panel1a-content" id="branches-panel" onClick={updateBranchesAccordionExpanded}>
                            <Typography>Branches</Typography>
                            <Typography variant="button" display="block" gutterBottom style={{paddingLeft: '10px'}}><b>{workspaceName}</b></Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            {
                                workspaceLoaded && <GitGraph branches={branches} logs={logs} handleSelectWorkspaceBranch={selectWorkspaceBranch} />
                            }
                        </AccordionDetails>
                    </Accordion>
                    <Divider />
                    <Accordion expanded={directoryAccordionExpanded}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="panel1a-content" id="panel1a-header" onClick={updateDirectoryAccordionExpanded}>
                            <Typography>Directory</Typography>
                            <Typography variant="button" display="block" gutterBottom style={{paddingLeft: '10px'}}><b>{branch}</b></Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            {
                                workspaceLoaded && branchLoaded &&
                                    <Box>
                                        <FileTree trigger={trigger} workspaceName={workspaceName} branchName={branch} handleLoadFiles={loadFiles} handleSelectFile={selectFile} />
                                        <Stack direction="row">
                                            <Button style={{marginTop: '10px'}} onClick={handleNewFileClick}>New File</Button>
                                        </Stack>
                                    </Box>
                            }
                        </AccordionDetails>
                    </Accordion>
                </Drawer>
                <div>
                    <FileEditor trigger={triggerFile} workspaceName={workspaceName} branchName={branch} fileName={file} isNewFile={isNewFile} branches={branches} handleFileEvent={fileEvent} />
                </div>
            </Box>
            <Dialog
                open={openNewWorkspaceDialog}
                onClose={handleCloseNewWorkspaceDialog}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
                fullWidth={true}
                maxWidth="sm"
            >
                <DialogTitle id="alert-new-workspace-dialog-title">
                    {"Create Workspace"}
                </DialogTitle>
                <DialogContent>
                    <TextField autoFocus required margin="dense" id="workspaceName" label="Workspace Name" fullWidth variant="standard" onChange = {(e) => {setNewWorkspaceName(e.target.value)}}/>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseNewWorkspaceDialog}>Close</Button>
                    <Button onClick={handleNewWorkspace} autoFocus>Save</Button>
                </DialogActions>
            </Dialog>
            <Dialog
                open={openNewFileDialog}
                onClose={handleCloseNewFileDialog}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
                fullWidth={true}
                maxWidth="sm"
            >
                <DialogTitle id="alert-new-file-dialog-title">
                    {"Create File"}
                </DialogTitle>
                <DialogContent>
                    {newFileErrorMessage && <Alert severity="error">{newFileErrorMessage}</Alert>}
                    <Box>
                        <TextField autoFocus required margin="dense" id="fileName" label="File Name" fullWidth variant="standard" onChange = {(e) => {setNewFileName(e.target.value)}}/>
                        <Stack direction="row"
                               justifyContent="left"
                               alignItems="center"
                               spacing={2}>
                            <Typography align="center">File Extension:</Typography>
                            <Select
                                labelId="file-extension-select"
                                id="file-extension-select"
                                value={fileExtension}
                                onChange={handleFileExtensionChange}
                            >
                                <MenuItem value="txt">txt</MenuItem>
                                <MenuItem value="rtf">rtf</MenuItem>
                                <MenuItem value="md">md</MenuItem>
                            </Select>
                        </Stack>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseNewFileDialog}>Close</Button>
                    <Button onClick={handleNewFile} autoFocus>Create</Button>
                </DialogActions>
            </Dialog>
            <Snackbar
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right'
                }}
                open={workspaceError}
                key={'errorMessage'}
                autoHideDuration={5000}
                onClose={() => setWorkspaceError(false)}
            >
                <Alert severity="error" sx={{ width: '100%' }}>
                    {workspaceErrorMessage}
                </Alert>
            </Snackbar>
        </div>
    )
}

export default Document
