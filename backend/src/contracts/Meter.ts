import {
    assert,
    ByteString,
    hash256,
    method,
    prop,
    SmartContract,
    SigHash
} from 'scrypt-ts'

export class WisnaeMeterContract extends SmartContract {
    @prop(true)
    count: bigint

    @prop(true)
    nextOwnerIdentityKey: ByteString

    @prop(true)
    creatorIdentityKey: ByteString

    @prop(true)
    creatorSignature: ByteString

    constructor(count: bigint, nextOwnerIdentityKey: ByteString, creatorIdentityKey: ByteString, creatorSignature: ByteString) {
        super(...arguments)
        this.count = count
        this.creatorIdentityKey = creatorIdentityKey
        this.creatorSignature = creatorSignature
        this.nextOwnerIdentityKey = nextOwnerIdentityKey
    }

    @method(SigHash.ANYONECANPAY_SINGLE)
    public incrementOnChain() {
        // Ensure the person who last incremented the contract cannot do so immediately again.
        this.wasNotMe()

        // Increment counter value
        this.increment()

        // make sure balance in the contract does not change
        const amount: bigint = this.ctx.utxo.value
        // outputs containing the latest state and an optional change output
        const outputs: ByteString = this.buildStateOutput(amount)
        // verify unlocking tx has the same outputs
        assert(this.ctx.hashOutputs == hash256(outputs), 'hashOutputs mismatch')
    }

    @method()
    increment(): void {
        this.count++
    }

    @method()
    wasNotMe(): void {
        assert(this.creatorIdentityKey != this.nextOwnerIdentityKey, 'The person who last updated the contract must wait for someone else to update it before they can do so again.') 
    }

    @method(SigHash.ANYONECANPAY_SINGLE)
    public decrementOnChain() {
        // Ensure the person who last decremented the contract cannot do so immediately again.
        this.wasNotMe()

        // Increment counter value
        this.decrement()

        // make sure balance in the contract does not change
        const amount: bigint = this.ctx.utxo.value
        // outputs containing the latest state and an optional change output
        const outputs: ByteString = this.buildStateOutput(amount)
        // verify unlocking tx has the same outputs
        assert(this.ctx.hashOutputs == hash256(outputs), 'hashOutputs mismatch')
    }

    @method()
    decrement(): void {
        this.count--
    }
}