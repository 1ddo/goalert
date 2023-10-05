import React, { useState } from 'react'
import makeStyles from '@mui/styles/makeStyles'
import {
  Button,
  Grid,
  Typography,
  Card,
  ButtonBase,
  CardHeader,
} from '@mui/material'
import { Add } from '@mui/icons-material'
import AdminAPIKeysDrawer from './admin-api-keys/AdminAPIKeysDrawer'
import { GQLAPIKey, CreatedGQLAPIKey } from '../../schema'
import { Time } from '../util/Time'
import { gql, useQuery } from 'urql'
import FlatList, { FlatListListItem } from '../lists/FlatList'
import Spinner from '../loading/components/Spinner'
import { GenericError } from '../error-pages'
import { Theme } from '@mui/material/styles'
import AdminAPIKeysActionDialog from './admin-api-keys/AdminAPIKeysActionDialog'
import AdminAPIKeysTokenDialog from './admin-api-keys/AdminAPIKeysTokenDialog'
import { DateTime } from 'luxon'
// query for getting existing API Keys
const query = gql`
  query gqlAPIKeysQuery {
    gqlAPIKeys {
      id
      name
      description
      createdAt
      createdBy {
        id
        name
      }
      updatedAt
      updatedBy {
        id
        name
      }
      lastUsed {
        time
        ua
        ip
      }
      expiresAt
      allowedFields
      role
    }
  }
`
const useStyles = makeStyles((theme: Theme) => ({
  root: {
    '& .MuiListItem-root': {
      'border-bottom': '1px solid #333333',
    },
  },
  buttons: {
    'margin-bottom': '15px',
  },
  containerDefault: {
    [theme.breakpoints.up('md')]: {
      maxWidth: '100%',
      transition: `max-width ${theme.transitions.duration.leavingScreen}ms ease`,
    },
    '& .MuiListItem-root': {
      padding: '0px',
    },
  },
  containerSelected: {
    [theme.breakpoints.up('md')]: {
      maxWidth: '70%',
      transition: `max-width ${theme.transitions.duration.enteringScreen}ms ease`,
    },
    '& .MuiListItem-root': {
      padding: '0px',
    },
  },
}))

export default function AdminAPIKeys(): JSX.Element {
  const classes = useStyles()
  const [selectedAPIKey, setSelectedAPIKey] = useState<GQLAPIKey | null>(null)
  const [tokenDialogClose, onTokenDialogClose] = useState(false)
  const [openActionAPIKeyDialog, setOpenActionAPIKeyDialog] = useState(false)
  const [create, setCreate] = useState(false)
  const emptyAPIKey = {
    id: '',
    name: '',
    description: '',
    createdAt: '',
    createdBy: null,
    updatedAt: '',
    updatedBy: null,
    lastUsed: null,
    expiresAt: DateTime.utc().plus({ days: 7 }).toISO(),
    allowedFields: [],
    role: 'user',
  }
  const [apiKey, setAPIKey] = useState<GQLAPIKey>(emptyAPIKey as GQLAPIKey)
  const [token, setToken] = useState<CreatedGQLAPIKey>({
    id: '',
    token: '',
  })
  // handles the openning of the create dialog form which is used for creating new API Key
  const handleOpenCreateDialog = (): void => {
    setSelectedAPIKey(null)
    setCreate(true)
    setAPIKey(emptyAPIKey as GQLAPIKey)
    setOpenActionAPIKeyDialog(!openActionAPIKeyDialog)
  }
  // Get API Key triggers/actions
  const [{ data, fetching, error }] = useQuery({ query })

  if (error) {
    return <GenericError error={error.message} />
  }

  if (fetching && !data) {
    return <Spinner />
  }

  const items = data.gqlAPIKeys.map(
    (key: GQLAPIKey): FlatListListItem => ({
      selected: (key as GQLAPIKey).id === selectedAPIKey?.id,
      highlight: (key as GQLAPIKey).id === selectedAPIKey?.id,
      subText: (
        <ButtonBase
          onClick={() => {
            setSelectedAPIKey(key)
          }}
          style={{ width: '100%', textAlign: 'left', padding: '5px 15px' }}
        >
          <Grid container>
            <Grid item xs justifyContent='flex-start'>
              <Typography gutterBottom variant='subtitle1' component='div'>
                {key.name}
              </Typography>
              <Typography gutterBottom variant='subtitle2' component='div'>
                <Time prefix='Expires At: ' time={key.expiresAt} />
              </Typography>
              <Typography gutterBottom variant='subtitle2' component='div'>
                {key.allowedFields.length + ' allowed fields (read-only)'}
              </Typography>
            </Grid>
            <Grid item>
              <Typography gutterBottom variant='subtitle2' component='div'>
                <Time prefix='Last Used: ' time={key.expiresAt} />
              </Typography>
            </Grid>
          </Grid>
        </ButtonBase>
      ),
    }),
  )

  return (
    <React.Fragment>
      {selectedAPIKey ? (
        <AdminAPIKeysDrawer
          onClose={() => {
            if (!openActionAPIKeyDialog) {
              setSelectedAPIKey(null)
            }
          }}
          apiKey={selectedAPIKey}
          setCreate={setCreate}
          setOpenActionAPIKeyDialog={setOpenActionAPIKeyDialog}
          setAPIKey={setAPIKey}
        />
      ) : null}
      {openActionAPIKeyDialog ? (
        <AdminAPIKeysActionDialog
          onClose={() => {
            setOpenActionAPIKeyDialog(false)
          }}
          onTokenDialogClose={onTokenDialogClose}
          setToken={setToken}
          create={create}
          apiKey={apiKey}
          setAPIKey={setAPIKey}
          setSelectedAPIKey={setSelectedAPIKey}
        />
      ) : null}
      {tokenDialogClose ? (
        <AdminAPIKeysTokenDialog
          input={token}
          onTokenDialogClose={onTokenDialogClose}
          tokenDialogClose={tokenDialogClose}
        />
      ) : null}
      <Card
        style={{ width: '100%', padding: '10px' }}
        className={
          selectedAPIKey ? classes.containerSelected : classes.containerDefault
        }
      >
        <CardHeader
          title='API Key List'
          component='h2'
          sx={{ paddingBottom: 0, margin: 0 }}
          action={
            <Button
              data-cy='new'
              variant='contained'
              className={classes.buttons}
              onClick={handleOpenCreateDialog}
              startIcon={<Add />}
            >
              Create API Key
            </Button>
          }
        />
        <FlatList emptyMessage='No Data Available' items={items} />
      </Card>
    </React.Fragment>
  )
}
