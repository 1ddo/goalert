import React from 'react'
import Grid from '@mui/material/Grid'
import { FormContainer, FormField } from '../../forms'
import { FieldError } from '../../util/errutil'
import { CreateGQLAPIKeyInput, UpdateGQLAPIKeyInput } from '../../../schema'
import AdminAPIKeyExpirationField from './AdminAPIKeyExpirationField'
import { gql, useQuery } from 'urql'
import { GenericError } from '../../error-pages'
import Spinner from '../../loading/components/Spinner'
import { TextField, MenuItem } from '@mui/material'
import MaterialSelect from '../../selection/MaterialSelect'

const query = gql`
  query ListGQLFieldsQuery {
    listGQLFields
  }
`

type EditProps = {
  value: UpdateGQLAPIKeyInput
  onChange: (key: UpdateGQLAPIKeyInput) => void
  create?: false
}

type CreateProps = {
  value: CreateGQLAPIKeyInput
  onChange: (key: CreateGQLAPIKeyInput) => void
  create: true
}

type AdminAPIKeyFormProps = {
  errors: FieldError[]
} & (EditProps | CreateProps)

export default function AdminAPIKeyForm(
  props: AdminAPIKeyFormProps,
): JSX.Element {
  const [{ data, fetching, error }] = useQuery({
    query,
  })

  if (error) {
    return <GenericError error={error.message} />
  }

  if (fetching && !data) {
    return <Spinner />
  }

  return (
    <FormContainer optionalLabels {...props}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <FormField fullWidth name='name' required component={TextField} />
        </Grid>
        <Grid item xs={12}>
          <FormField
            fullWidth
            name='description'
            multiline
            rows={4}
            required
            component={TextField}
            charCount={255}
            hint='Markdown Supported'
          />
        </Grid>
        <Grid item xs={12}>
          <FormField
            fullWidth
            component={TextField}
            select
            required
            name='role'
            disabled={!props.create}
          >
            <MenuItem value='user' key='user'>
              User
            </MenuItem>
            <MenuItem value='admin' key='admin'>
              Admin
            </MenuItem>
          </FormField>
        </Grid>
        <Grid item xs={12}>
          <FormField
            fullWidth
            component={AdminAPIKeyExpirationField}
            select
            required
            name='expiresAt'
            disabled={!props.create}
          />
        </Grid>
        <Grid item xs={12}>
          <FormField
            fullWidth
            component={MaterialSelect}
            name='allowedFields'
            disabled={!props.create}
            clientSideFilter
            disableCloseOnSelect
            optionsLimit={10}
            options={data.listGQLFields.map((field: string) => ({
              label: field,
              value: field,
            }))}
            multiple
          />
        </Grid>
      </Grid>
    </FormContainer>
  )
}
