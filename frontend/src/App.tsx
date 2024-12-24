import React, { useState, type FormEvent } from 'react'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import {
  AppBar, Toolbar, List, ListItem, Dialog,
  DialogTitle, DialogContent, DialogContentText, DialogActions,
  Button, Fab, LinearProgress, Typography, IconButton, Grid
} from '@mui/material'
import { styled } from '@mui/system'
import AddIcon from '@mui/icons-material/Add'
import GitHubIcon from '@mui/icons-material/GitHub'
import useAsyncEffect from 'use-async-effect'
import {
  createAction,
  createSignature,
  EnvelopeEvidenceApi,
  getPublicKey,
  toBEEFfromEnvelope
} from '@babbage/sdk-ts'
import { type Meter, type Token } from './types/types'
import './App.scss'
import { IdentityCard } from 'metanet-identity-react'
import { WisnaeMeterContract, MeterArtifact } from '@bsv/backend'
import { SHIPBroadcaster, LookupResolver, Transaction, Utils, ProtoWallet, PrivateKey } from '@bsv/sdk'
import { toEnvelopeFromBEEF } from '@babbage/sdk-ts/out/src/utils/toBEEF'
WisnaeMeterContract.loadArtifact(MeterArtifact)
import { bsv, toByteString } from 'scrypt-ts'

const anyoneWallet = new ProtoWallet('anyone')

// These are some basic styling rules for the React application.
// We are using MUI (https://mui.com) for all of our UI components (i.e. buttons and dialogs etc.).
const AppBarPlaceholder = styled('div')({
  height: '4em'
})

const NoItems = styled(Grid)({
  margin: 'auto',
  textAlign: 'center',
  marginTop: '5em'
})

const AddMoreFab = styled(Fab)({
  position: 'fixed',
  right: '1em',
  bottom: '1em',
  zIndex: 10
})

const LoadingBar = styled(LinearProgress)({
  margin: '1em'
})

const GitHubIconStyle = styled(IconButton)({
  color: '#ffffff'
})

const App: React.FC = () => {
  // These are some state variables that control the app's interface.
  const [isMncMissing, setIsMncMissing] = useState<boolean>(false)
  const [createOpen, setCreateOpen] = useState<boolean>(false)
  const [createLoading, setCreateLoading] = useState<boolean>(false)
  const [metersLoading, setMetersLoading] = useState<boolean>(true)
  const [meters, setMeters] = useState<Meter[]>([])
  const [identityKey, setIdentityKey] = useState<string>("")


  // Creates a new meter.
  // This function will run when the user clicks "OK" in the creation dialog.
  const handleCreateSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault() // Stop the HTML form from reloading the page.
    try {
      // Now, we start a loading bar before the heavy lifting.
      setCreateLoading(true)
      const pubKeyResult = await getPublicKey({ identityKey: true })
      const anyKey = PrivateKey.fromRandom().toPublicKey().toString()

      const signature = await createSignature({
        data: new Uint8Array([1]),
        protocolID: [0, 'wisnaemeter'],
        keyID: '1',
        counterparty: 'anyone'
      })
      const signatureHex = Utils.toHex(Array.from(new Uint8Array(signature)))

      // Get locking script
      const meter = new WisnaeMeterContract(
        BigInt(1),
        toByteString(pubKeyResult, false),
        toByteString(anyKey, false),
        toByteString(signatureHex, false)
      )
      const lockingScript = meter.lockingScript.toHex()
      const transactionEnvelope = await createAction({
        description: 'Create a meter',
        outputs: [{
          script: lockingScript,
          satoshis: 1,
          description: 'wisnaemeter output'
        }]
      })
      const beefTx = toBEEFfromEnvelope(transactionEnvelope as EnvelopeEvidenceApi)
      const broadcaster = new SHIPBroadcaster(['tm_wisnae_meter'])
      // Send the transaction to the overlay network
      const broadcastResult = await beefTx.tx.broadcast(broadcaster)
      console.log(broadcastResult)

      // created, and added to the list.
      toast.dark('Meter successfully created!')
      setMeters((originalMeters) => ([
        {
          value: 1,
          creatorIdentityKey: pubKeyResult,
          token: {
            ...transactionEnvelope,
            rawTX: transactionEnvelope.rawTx,
            outputIndex: 0,
            lockingScript: lockingScript,
            satoshis: 1
          } as Token
        },
        ...originalMeters
      ]))
      setCreateOpen(false)
    } catch (e) {
      // Any errors are shown on the screen and printed in the developer console
      toast.error((e as Error).message)
      console.error(e)
    } finally {
      setCreateLoading(false)
    }
  }

  // Load meters
  useAsyncEffect(async () => {
    try {
      const resolver = new LookupResolver()
      const lookupResult = await resolver.query({
        service: 'ls_wisnae_meter',
        query: 'findAll'
      })
      if (lookupResult.type !== 'output-list') {
        throw new Error('Wrong result type!')
      }
      console.log({ lookupResult })
      const parsedResults: Meter[] = []
      for (const result of lookupResult.outputs) {
        const tx = Transaction.fromBEEF(result.beef)
        const script = tx.outputs[result.outputIndex].lockingScript.toHex()
        const meter = WisnaeMeterContract.fromLockingScript(script) as WisnaeMeterContract
        const convertedToken = toEnvelopeFromBEEF(result.beef)

        const verifyResult = await anyoneWallet.verifySignature({
          protocolID: [0, 'wisnaemeter'],
          keyID: '1',
          counterparty: meter.creatorIdentityKey,
          data: [1],
          signature: Utils.toArray(meter.creatorSignature, 'hex')
        })
        if (verifyResult.valid !== true) {
          throw new Error('Signature invalid')
        }

        parsedResults.push({
          value: Number(meter.count),
          creatorIdentityKey: String(meter.creatorIdentityKey),
          token: {
            ...convertedToken,
            rawTX: convertedToken.rawTx,
            txid: tx.id('hex'),
            outputIndex: result.outputIndex,
            lockingScript: script,
            satoshis: tx.outputs[result.outputIndex].satoshis as number
          } as Token
        })
      }
      console.log({ parsedResults })
      setMeters(parsedResults)
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setMetersLoading(false)
    }
  }, [])

  // Handle decrement
  const handleDecrement = async (meterIndex: number) => {
    try {
      // Spend the token and create a neww transaction
      const m = meters[meterIndex]
      const meter = WisnaeMeterContract.fromLockingScript(m.token.lockingScript)
      const nextMeter = WisnaeMeterContract.fromLockingScript(m.token.lockingScript) as WisnaeMeterContract
      nextMeter.decrement()
      const pubKeyResult = await getPublicKey({ identityKey: true })
      nextMeter.setNextOwnerIdentityKey(toByteString(pubKeyResult, false))
      const nextScript = nextMeter.lockingScript
      const parsedFromTx = new bsv.Transaction(m.token.rawTX)
      const unlockingScript = await meter.getUnlockingScript(async (self) => {
        const bsvtx = new bsv.Transaction()
        bsvtx.from({
          txId: m.token.txid,
          outputIndex: m.token.outputIndex,
          script: m.token.lockingScript,
          satoshis: m.token.satoshis
        })
        bsvtx.addOutput(new bsv.Transaction.Output({
          script: nextScript,
          satoshis: m.token.satoshis
        }))
        self.to = { tx: bsvtx, inputIndex: 0 }
        self.from = { tx: parsedFromTx, outputIndex: 0 }
          ; (self as WisnaeMeterContract).decrementOnChain(pubKeyResult)
      })
      console.log('Got unlocking script', unlockingScript)
      const broadcastActionParams = {
        inputs: {
          [m.token.txid]: {
            ...m.token,
            rawTx: m.token.rawTX,
            outputsToRedeem: [{
              index: m.token.outputIndex,
              unlockingScript: unlockingScript.toHex(),
              spendingDescription: 'Previous counter token'
            }]
          }
        },
        outputs: [{
          script: nextScript.toHex(),
          satoshis: m.token.satoshis,
          description: 'counter token'
        }],
        description: `Decrement a counter`,
        acceptDelayedBroadcast: false
      }
      let currentTX = await createAction(broadcastActionParams)
      const beefTx = toBEEFfromEnvelope(currentTX as EnvelopeEvidenceApi)
      // Send the transaction to the overlay network
      const broadcastResult = await beefTx.tx.broadcast(new SHIPBroadcaster(['tm_wisnae_meter']))
      console.log(broadcastResult)

      setMeters((originalMeters) => {
        const copy = [...originalMeters]
        copy[meterIndex].value--
        return copy
      })
    } catch (error) {
      toast.error((error as Error).message)
    }
  }

  // Handle increment
  const handleIncrement = async (meterIndex: number) => {
    try {
      // Spend the token and create a neww transaction
      const m = meters[meterIndex]
      const meter = WisnaeMeterContract.fromLockingScript(m.token.lockingScript)
      const nextMeter = WisnaeMeterContract.fromLockingScript(m.token.lockingScript) as WisnaeMeterContract
      nextMeter.increment()
      const pubKeyResult = await getPublicKey({ identityKey: true })
      nextMeter.setNextOwnerIdentityKey(toByteString(pubKeyResult, false))
      const nextScript = nextMeter.lockingScript
      const parsedFromTx = new bsv.Transaction(m.token.rawTX)
      const unlockingScript = await meter.getUnlockingScript(async (self) => {
        const bsvtx = new bsv.Transaction()
        bsvtx.from({
          txId: m.token.txid,
          outputIndex: m.token.outputIndex,
          script: m.token.lockingScript,
          satoshis: m.token.satoshis
        })
        bsvtx.addOutput(new bsv.Transaction.Output({
          script: nextScript,
          satoshis: m.token.satoshis
        }))
        self.to = { tx: bsvtx, inputIndex: 0 }
        self.from = { tx: parsedFromTx, outputIndex: 0 }
          ; (self as WisnaeMeterContract).incrementOnChain(pubKeyResult)
      })
      console.log('Got unlocking script', unlockingScript)
      const broadcastActionParams = {
        inputs: {
          [m.token.txid]: {
            ...m.token,
            rawTx: m.token.rawTX,
            outputsToRedeem: [{
              index: m.token.outputIndex,
              unlockingScript: unlockingScript.toHex(),
              spendingDescription: 'Previous counter token'
            }]
          }
        },
        outputs: [{
          script: nextScript.toHex(),
          satoshis: m.token.satoshis,
          description: 'counter token'
        }],
        description: `Increment a counter`,
        acceptDelayedBroadcast: false
      }
      let currentTX = await createAction(broadcastActionParams)
      const beefTx = toBEEFfromEnvelope(currentTX as EnvelopeEvidenceApi)
      // Send the transaction to the overlay network
      const broadcastResult = await beefTx.tx.broadcast(new SHIPBroadcaster(['tm_wisnae_meter']))
      console.log(broadcastResult)

      setMeters((originalMeters) => {
        const copy = [...originalMeters]
        copy[meterIndex].value++
        return copy
      })
    } catch (error) {
      toast.error((error as Error).message)
    }
  }

  // The rest of this file just contains some UI code. All the juicy
  // Bitcoin - related stuff is above.

  // ----------

  return (
    <>
      <ToastContainer
        position='top-right'
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <AppBar position='static'>
        <Toolbar>
          <Typography variant='h6' component='div' sx={{ flexGrow: 1 }}>
            WisnaeMeter — Counters, Up and Down, so long as you weren't the last one to do it.
          </Typography>
          <GitHubIconStyle onClick={() => window.open('https://github.com/p2ppsr/meter', '_blank')}>
            <GitHubIcon />
          </GitHubIconStyle>
        </Toolbar>
      </AppBar>
      <AppBarPlaceholder />

      {meters.length >= 1 && (
        <AddMoreFab color='primary' onClick={() => { setCreateOpen(true) }}>
          <AddIcon />
        </AddMoreFab>
      )}

      {metersLoading
        ? (<LoadingBar />)
        : (
          <List>
            {meters.length === 0 && (
              <NoItems container direction='column' justifyContent='center' alignItems='center'>
                <Grid item align='center'>
                  <Typography variant='h4'>Nae WisnaeMeters</Typography>
                  <Typography color='textSecondary'>
                    Use the button below to start a wisnaemeter
                  </Typography>
                </Grid>
                <Grid item align='center' sx={{ paddingTop: '2.5em', marginBottom: '1em' }}>
                  <Fab color='primary' onClick={() => { setCreateOpen(true) }}>
                    <AddIcon />
                  </Fab>
                </Grid>
              </NoItems>
            )}
            {meters.map((x, i) => (
              // x properties:
              // - value: number
              // - creatorIdentityKey: string
              // - token: Token
              <ListItem key={i}>
                <Button onClick={() => handleDecrement(i)}>Decrement</Button>
                <Typography>{x.value}</Typography>
                <Button onClick={() => handleIncrement(i)}>Increment</Button>
                <IdentityCard
                  themeMode='dark'
                  identityKey={x.creatorIdentityKey}
                />
              </ListItem>
            ))}
          </List>
        )
      }

      <Dialog open={createOpen} onClose={() => { setCreateOpen(false) }}>
        <form onSubmit={(e) => {
          e.preventDefault()
          void (async () => {
            try {
              await handleCreateSubmit(e)
            } catch (error) {
              console.error('Error in form submission:', error)
            }
          })()
        }}>
          <DialogTitle>Create a WisnaeMeter</DialogTitle>
          <DialogContent>
            <DialogContentText paragraph>
              Meters can be incremented and decremented after creation; but only by someone other than the last person to interact with it.
            </DialogContentText>
          </DialogContent>
          {createLoading
            ? (<LoadingBar />)
            : (
              <DialogActions>
                <Button onClick={() => { setCreateOpen(false) }}>Cancel</Button>
                <Button type='submit'>OK</Button>
              </DialogActions>
            )
          }
        </form>
      </Dialog>
    </>
  )
}

export default App
