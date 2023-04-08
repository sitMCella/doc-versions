import React, {useEffect, useState} from 'react';
import {
    Alert,
    Avatar,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    IconButton,
    ListItem,
    ListItemAvatar,
    ListItemButton,
    ListItemText,
    Snackbar
} from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import DeleteIcon from "@mui/icons-material/Delete";

function Workspace (props) {
    const [branches, setBranches] = useState([])
    const [branchesError, setBranchesError] = useState(false)
    const [branchesErrorMessage, setBranchesErrorMessage] = useState('')
    const [logs, setLogs] = useState([])
    const [openDeleteWorkspaceDialog, setOpenDeleteWorkspaceDialog] = useState(false)

    const getBranches = async (signal) => {
        const headers = {
            Accepted: 'application/json'
        }
        const response = await fetch('/workspaces/' + props.name + '/branches', {
            method: 'GET',
            headers: headers,
            signal
        })
        if (!response.ok) {
            throw new Error(JSON.stringify(response))
        }
        const responseData = await response.json()
        const loadedBranches = []
        for (const key in responseData) {
            loadedBranches.push({
                name: responseData[key].name
            })
        }
        return loadedBranches
    }

    const getBranchLogs = async (key, branchName) => {
        const headers = {
            Accepted: 'application/json'
        }
        const response = await fetch('/workspaces/' + props.name + '/branches/' + branchName + '/logs', {
            method: 'GET',
            headers: headers
        })
        if (!response.ok) {
            throw new Error(JSON.stringify(response))
        }
        const responseData = await response.json()
        const loadedLogs = []
        for (const key in responseData) {
            loadedLogs.push({
                branch_name: branchName,
                commit_uuid: responseData[key].commit_uuid,
                message: responseData[key].message
            })
        }
        return loadedLogs
    }

    const getLogs = async (b) => {
        setBranchesError(false)
        let assignedLogs = []
        for (const key in b) {
            const newLogs = await getBranchLogs(key, b[key].name)
            assignedLogs = [...assignedLogs, ...newLogs]
        }
        return assignedLogs
    }

    const handleWorkspaceClick = () => {
        setLogs([])
        props.handleReloadWorkspaceLogs()
        getBranches()
            .then((b) => {
                setBranches(b)
                getLogs(b)
                    .then((l) => {
                        setLogs(l)
                        props.handleWorkspaceLogs(props.name, b, l)
                    })
                    .catch((err) => {
                        console.log('Error while retrieving the branch logs: ' + err.message)
                        setBranchesError(true)
                        setBranchesErrorMessage('Cannot retrieve the branch logs, please refresh the page.')
                    })
            })
            .catch((err) => {
                console.log('Error while retrieving the Workspace branches: ' + err.message)
                setBranchesError(true)
                setBranchesErrorMessage('Cannot retrieve the Workspace branches, please refresh the page.')
            })
    }

    const deleteWorkspace = async () => {
        const headers = {
            Accepted: 'application/json'
        }
        const response = await fetch('/workspaces/' + props.name, {
            method: 'DELETE',
            headers: headers
        })
        if (!response.ok) {
            throw new Error(JSON.stringify(response))
        }
    }

    const handleDeleteWorkspace = () => {
        deleteWorkspace()
            .then((b) => {
                setOpenDeleteWorkspaceDialog(false)
                props.handleDeleteWorkspace(props.name)
            })
            .catch((err) => {
                console.log('Error while deleting the Workspace: ' + err.message)
                setBranchesError(true)
                setBranchesErrorMessage('Cannot delete the Workspace.')
            })
    }

    const handleDeleteWorkspaceDialogClick = () => {
        setOpenDeleteWorkspaceDialog(true)
    }

    const handleCloseDeleteWorkspaceDialog = () => {
        setOpenDeleteWorkspaceDialog(false)
    }

    useEffect(() => {
        handleWorkspaceClick()
    }, [props.trigger])

    return (
        <div>
            <ListItemButton
                onClick={handleWorkspaceClick}
            >
                <ListItem
                    secondaryAction={
                        <IconButton edge="end" aria-label="delete">
                            <DeleteIcon onClick={handleDeleteWorkspaceDialogClick} />
                        </IconButton>
                    }
                >
                    <ListItemAvatar>
                        <Avatar>
                            <FolderIcon />
                        </Avatar>
                    </ListItemAvatar>
                    <ListItemText primary={props.name} />
                </ListItem>
            </ListItemButton>
            <Dialog
                open={openDeleteWorkspaceDialog}
                onClose={handleCloseDeleteWorkspaceDialog}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
                fullWidth={true}
                maxWidth="sm"
            >
                <DialogTitle id="alert-dialog-title">
                    {"Delete Workspace"}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">
                        The workspace {props.name} and all of its content will be completely deleted.<br/>
                        Do you want to proceed?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDeleteWorkspaceDialog}>Close</Button>
                    <Button onClick={handleDeleteWorkspace} autoFocus>Delete</Button>
                </DialogActions>
            </Dialog>
            <Snackbar
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right'
                }}
                open={branchesError}
                key={'errorMessage'}
                autoHideDuration={5000}
                onClose={() => setBranchesError(false)}
            >
                <Alert severity="error" sx={{ width: '100%' }}>
                    {branchesErrorMessage}
                </Alert>
            </Snackbar>
        </div>
    )
}

export default Workspace
