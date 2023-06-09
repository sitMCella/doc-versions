import React, {useEffect, useRef, useState} from 'react'
import {Editor, EditorState, convertFromRaw, convertToRaw} from 'draft-js'
import { Editor as EditorWysiwyg} from "react-draft-wysiwyg"
import Card from '@mui/material/Card'
import 'draft-js/dist/Draft.css'
import "react-draft-wysiwyg/dist/react-draft-wysiwyg.css"
import "./FileEditor.css"
import {Alert, Button, CardActions, CardContent, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, InputLabel, MenuItem, Select, Snackbar, Stack, TextField, Typography} from "@mui/material"

function FileEditor (props) {
    const [fileError, setFileError] = useState(false)
    const [fileErrorMessage, setFileErrorMessage] = useState('')
    const [editorState, setEditorState] = useState(EditorState.createEmpty())
    const [openSaveFileDialog, setOpenSaveFileDialog] = useState(false)
    const [commitMessage, setCommitMessage] =  useState('')
    const [branchName, setBranchName] =  useState(props.branchName)
    const [fileName, setFileName] =  useState(props.fileName)
    const [openDeleteFileDialog, setDeleteSaveFileDialog] = useState(false)
    const [editorSaveButtonDisabled, setEditorSaveButtonDisabled] = useState(true)
    const [editorDeleteButtonDisabled, setEditorDeleteButtonDisabled] = useState(true)
    const [fontFamily, setFontFamily] = useState('Georgia')
    const [fontSize, setFontSize] = useState('14')
    const editorRef = useRef(null)
    const [rtfFile, setRtfFile] = useState(false)

    const fontFamilies = [
        "Arial", "Arial Black", "Times New Roman", "Helvetica", "Verdana", "Tahoma", "Trebuchet MS", "Impact", "Gill Sans", "Georgia",
        "Palatino", "Baskerville", "Andalé Mono", "Courier", "Lucida Console", "Monaco", "Bradley Hand", "Brush Script MT", "Luminari",
        "Comic Sans MS", "Optima", "Didot", "American Typewriter"
    ]

    const fontSizes = ["9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "20", "22", "24", "36", "48", "64"]

    const createEditorSimpleTextFile = (text) => {
        const lines = text.split(/\r?\n/)
        const blocks = []
        for (const line of lines) {
            const key = (Math.random() + 1).toString(36).substring(8)
            const block = {
                key,
                text: line,
                type: "unstyled",
                depth: 0,
                inlineStyleRanges: [],
                entityRanges: [],
                data: {},
            }
            blocks.push(block)
        }
        return convertFromRaw({
            blocks,
            entityMap: {},
        })
    }

    const getFile = async (branchName, fileName, signal) => {
        const headers = {
            Accepted: 'application/json'
        }
        const response = await fetch('/api/workspaces/' + props.workspaceName + '/branches/' + branchName + '/files/' + fileName, {
            method: 'GET',
            headers,
            signal
        })
        if (!response.ok) {
            throw new Error(JSON.stringify(response))
        }
        const responseData = await response.blob()
        const loadedFile = await responseData.text()
        const isRtfFile = fileName.endsWith(".rtf")
        const newEditorState = isRtfFile ? convertFromRaw(JSON.parse(loadedFile)) : createEditorSimpleTextFile(loadedFile)
        setEditorState(EditorState.createWithContent(newEditorState))
    }

    useEffect(() => {
        setBranchName(props.branchName)
        setFileName(props.fileName)
        setRtfFile(props.fileName.endsWith(".rtf"))
        if (props.trigger) {
            focusEditor()
            if (props.isNewFile === true) {
                setEditorDeleteButtonDisabled(true)
                setEditorSaveButtonDisabled(false)
            } else if (props.fileName === '') {
                setEditorSaveButtonDisabled(true)
                setEditorDeleteButtonDisabled(true)
            } else {
                setEditorSaveButtonDisabled(false)
                setEditorDeleteButtonDisabled(false)
            }
            if (props.isNewFile === true || props.fileName === '') {
                setEditorState(EditorState.createEmpty())
                return
            }
            getFile(props.branchName, props.fileName)
                .then(() => setFileError(false))
                .catch((err) => {
                    console.log('Error while retrieving the file: ' + err.message)
                    setEditorState(EditorState.createEmpty())
                    setFileError(true)
                    setFileErrorMessage('Cannot retrieve the file.')
                })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.trigger])

    const handleClickFileSave = () => {
        setOpenSaveFileDialog(true)
    }

    const handleCloseFileSaveDialog = () => {
        setOpenSaveFileDialog(false)
    }

    const createFile = async () => {
        const headers = {
            'Content-Type': 'multipart/form-data'
        }
        console.log(convertToRaw(editorState.getCurrentContent()))
        const text = rtfFile ? JSON.stringify(convertToRaw(editorState.getCurrentContent())) : editorState.getCurrentContent().getPlainText()
        const data = new FormData()
        data.append('file', text)
        data.append('commit_message', commitMessage)
        const options = {
            method: 'POST',
            headers,
            body: data
        }
        delete options.headers['Content-Type']
        const response = await fetch('/api/workspaces/' + props.workspaceName + '/branches/' + branchName + '/files/' + fileName, options)
        if (!response.ok) {
            throw new Error(JSON.stringify(response))
        }
    }

    const updateFile = async () => {
        const headers = {
            'Content-Type': 'multipart/form-data'
        }
        const text = rtfFile ? JSON.stringify(convertToRaw(editorState.getCurrentContent())) : editorState.getCurrentContent().getPlainText()
        const data = new FormData()
        data.append('file', text)
        data.append('commit_message', commitMessage)
        const options = {
            method: 'PUT',
            headers,
            body: data
        }
        delete options.headers['Content-Type']
        const response = await fetch('/api/workspaces/' + props.workspaceName + '/branches/' + branchName + '/files/' + fileName, options)
        if (!response.ok) {
            throw new Error(JSON.stringify(response))
        }
    }

    const createBranch = async (signal) => {
        const headers = {
            Accepted: 'application/json'
        }
        const response = await fetch('/api/workspaces/' + props.workspaceName + '/branches/' + branchName, {
            method: 'POST',
            headers,
            signal
        })
        if (!response.ok) {
            throw new Error(JSON.stringify(response))
        }
    }

    const handleFileSave = () => {
        const branchExists = props.branches.filter(branch => branch.name === branchName)
        if (branchExists.length > 0) {
            if (props.isNewFile === true || props.fileName !== fileName) {
                createFile()
                    .then(() => {
                        setOpenSaveFileDialog(false)
                        props.handleFileEvent(false)
                    })
                    .catch((err) => {
                        console.log('Error while creating the file: ' + err.message)
                        setFileError(true)
                        setFileErrorMessage('Cannot create the file.')
                    })
            } else {
                updateFile()
                    .then(() => {
                        setOpenSaveFileDialog(false)
                    })
                    .catch((err) => {
                        console.log('Error while updating the file: ' + err.message)
                        setFileError(true)
                        setFileErrorMessage('Cannot update the file.')
                    })
            }
        } else {
            if (props.isNewFile === true || props.fileName !== fileName) {
                createBranch()
                    .then(() => {
                        createFile()
                            .then(() => {
                                setOpenSaveFileDialog(false)
                                props.handleFileEvent(false)
                            })
                            .catch((err) => {
                                console.log('Error while creating the file: ' + err.message)
                                setFileError(true)
                                setFileErrorMessage('Cannot create the file.')
                            })
                    })
                    .catch((err) => {
                        console.log('Error while creating a new branch: ' + err.message)
                        setFileError(true)
                        setFileErrorMessage('Cannot create the new branch.')
                    })
            } else {
                createBranch()
                    .then(() => {
                        updateFile()
                            .then(() => {
                                setOpenSaveFileDialog(false)
                            })
                            .catch((err) => {
                                console.log('Error while updating the file: ' + err.message)
                                setFileError(true)
                                setFileErrorMessage('Cannot update the file.')
                            })
                    })
                    .catch((err) => {
                        console.log('Error while creating a new branch: ' + err.message)
                        setFileError(true)
                        setFileErrorMessage('Cannot create the new branch.')
                    })
            }
        }
    }

    const handleClickFileDelete = () => {
        setDeleteSaveFileDialog(true)
    }

    const handleCloseFileDeleteDialog = () => {
        setDeleteSaveFileDialog(false)
    }

    const deleteFile = async () => {
        const headers = {
            'Content-Type': 'multipart/form-data'
        }
        const data = new FormData()
        data.append('commit_message', commitMessage)
        const options = {
            method: 'DELETE',
            headers,
            body: data
        }
        delete options.headers['Content-Type']
        const response = await fetch('/api/workspaces/' + props.workspaceName + '/branches/' + branchName + '/files/' + fileName, options)
        if (!response.ok) {
            throw new Error(JSON.stringify(response))
        }
    }

    const handleFileDelete = () => {
        const branchExists = props.branches.filter(branch => branch.name === branchName)
        if (branchExists.length > 0) {
            deleteFile()
                .then(() => {
                    setDeleteSaveFileDialog(false)
                    props.handleFileEvent(true)
                })
                .catch((err) => {
                    console.log('Error while deleting the file: ' + err.message)
                    setFileError(true)
                    setFileErrorMessage('Cannot delete the file.')
                })
        } else {
            createBranch()
                .then(() => {
                    deleteFile()
                        .then(() => {
                            setDeleteSaveFileDialog(false)
                            props.handleFileEvent(true)
                        })
                        .catch((err) => {
                            console.log('Error while updating the file: ' + err.message)
                            setFileError(true)
                            setFileErrorMessage('Cannot delete the file.')
                        })
                })
                .catch((err) => {
                    console.log('Error while creating a new branch: ' + err.message)
                    setFileError(true)
                    setFileErrorMessage('Cannot create the new branch.')
                })
        }
    }

    const handleChangeFontFamily = (e) => {
        setFontFamily(e.target.value)
    }

    const handleChangeFontSize = (e) => {
        setFontSize(e.target.value)
    }

    const focusEditor = () => {
        if(editorRef !== null && editorRef.current !== null && editorRef.current.focus !== undefined) {
            editorRef.current.focus()
        }
    }

    return (
        <div className="content">
            <Card sx={{ marginLeft: props.leftPosition + 'px', width: window.innerWidth - props.rightPosition - props.leftPosition + 435 - 490 + 'px' }}>
                <CardContent>
                    <Stack direction="row" style={{userSelect: 'none'}}>
                        <Typography variant="h7" color="text.secondary" gutterBottom>{props.fileName}</Typography>
                    </Stack>
                    { !rtfFile &&
                        <div className="RichEditor-root" onClick={focusEditor}>
                            <Stack direction="row">
                                <FormControl sx={{width: '25ch'}}>
                                    <InputLabel id="font-family-select-label">Font Family</InputLabel>
                                    <Select
                                        labelId="font-family-select-label"
                                        id="font-family-select"
                                        value={fontFamily}
                                        label="Font Family"
                                        onChange={handleChangeFontFamily}
                                    >
                                        {fontFamilies.map((font,index) =>
                                            <MenuItem key={index} value={font}>{font}</MenuItem>
                                        )}
                                    </Select>
                                </FormControl>
                                <FormControl sx={{width: '15ch'}}>
                                    <InputLabel id="font-size-select-label">Font Size</InputLabel>
                                    <Select
                                        labelId="font-size-select-label"
                                        id="font-size-select"
                                        value={fontSize}
                                        label="Font Size"
                                        onChange={handleChangeFontSize}
                                    >
                                        {fontSizes.map((font, index) =>
                                            <MenuItem key={index} value={font}>{font}</MenuItem>
                                        )}
                                    </Select>
                                </FormControl>
                            </Stack>
                            <div className="RichEditor-editor" style={{fontFamily, fontSize: fontSize + 'px'}}>
                                <Editor
                                    editorState={editorState}
                                    onChange={setEditorState}
                                    wrapperClassName="wrapper-class"
                                    editorClassName="editor-class"
                                    toolbarClassName="toolbar-class"
                                    ref={editorRef}
                                />
                            </div>
                        </div>
                    }
                    { rtfFile &&
                        <EditorWysiwyg
                            editorState={editorState}
                            onEditorStateChange={setEditorState}
                            wrapperClassName="wrapper-class"
                            editorClassName="editor-class"
                            toolbarClassName="toolbar-class"
                            ref={editorRef}
                        />
                    }
                </CardContent>
                <CardActions>
                    <Stack direction="row">
                        <Button disabled={editorSaveButtonDisabled} size="small" onClick={handleClickFileSave}>Save</Button>
                        <Button disabled={editorDeleteButtonDisabled} size="small" onClick={handleClickFileDelete}>Delete</Button>
                    </Stack>
                </CardActions>
            </Card>
            <Dialog
                open={openSaveFileDialog}
                onClose={handleCloseFileSaveDialog}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
                fullWidth={true}
                maxWidth="sm"
            >
                <DialogTitle id="alert-dialog-title">
                    {"Save File"}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">
                        Save the file with the following configuration:<br/>
                        Workspace name: {props.workspaceName}
                    </DialogContentText>
                    <TextField autoFocus margin="dense" id="branchName" label="Branch Name" fullWidth variant="standard" defaultValue={branchName} onChange = {(e) => {setBranchName(e.target.value)}}/>
                    <TextField autoFocus margin="dense" id="fileName" label="File Name" fullWidth variant="standard" defaultValue={props.fileName} onChange = {(e) => {setFileName(e.target.value)}}/>
                    <TextField autoFocus required margin="dense" id="commitMessage" label="Commit Message" fullWidth variant="standard" onChange = {(e) => {setCommitMessage(e.target.value)}}/>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseFileSaveDialog}>Close</Button>
                    <Button onClick={handleFileSave} autoFocus>Save</Button>
                </DialogActions>
            </Dialog>
            <Dialog
                open={openDeleteFileDialog}
                onClose={handleCloseFileDeleteDialog}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
                fullWidth={true}
                maxWidth="sm"
            >
                <DialogTitle id="alert-dialog-title">
                    {"Delete File"}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">
                        Delete the file with the following configuration:<br/>
                        Workspace name: {props.workspaceName}
                    </DialogContentText>
                    <TextField autoFocus margin="dense" id="branchName" label="Branch Name" fullWidth variant="standard" defaultValue={branchName} onChange = {(e) => {setBranchName(e.target.value)}}/>
                    <TextField disabled margin="dense" id="fileName" label="File Name" fullWidth variant="standard" defaultValue={fileName}/>
                    <TextField autoFocus required margin="dense" id="commitMessage" label="Commit Message" fullWidth variant="standard" onChange = {(e) => {setCommitMessage(e.target.value)}}/>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseFileDeleteDialog}>Close</Button>
                    <Button onClick={handleFileDelete} autoFocus>Delete</Button>
                </DialogActions>
            </Dialog>
            <Snackbar
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right'
                }}
                open={fileError}
                key={'errorMessage'}
                autoHideDuration={5000}
                onClose={() => setFileError(false)}
            >
                <Alert severity="error" sx={{ width: '100%' }}>
                    {fileErrorMessage}
                </Alert>
            </Snackbar>
        </div>
    )
}

export default FileEditor
