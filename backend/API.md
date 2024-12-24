# API

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

## Interfaces

| |
| --- |
| [MeterRecord](#interface-meterrecord) |
| [UTXOReference](#interface-utxoreference) |

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

---

### Interface: MeterRecord

```ts
export interface MeterRecord {
    txid: string;
    outputIndex: number;
    value: number;
    creatorIdentityKey: string;
    createdAt: Date;
}
```

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

---
### Interface: UTXOReference

```ts
export interface UTXOReference {
    txid: string;
    outputIndex: number;
}
```

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

---
## Classes

| |
| --- |
| [MeterStorage](#class-meterstorage) |
| [WisnaeMeterContract](#class-wisnaemetercontract) |

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

---

### Class: MeterStorage

```ts
export class MeterStorage {
    constructor(private readonly db: Db) 
    async storeRecord(txid: string, outputIndex: number, value: number, creatorIdentityKey: string): Promise<void> 
    async deleteRecord(txid: string, outputIndex: number): Promise<void> 
    async findAll(): Promise<UTXOReference[]> 
}
```

See also: [UTXOReference](#interface-utxoreference)

<details>

<summary>Class MeterStorage Details</summary>

#### Constructor

Constructs a new MeterStorageEngine instance

```ts
constructor(private readonly db: Db) 
```

Argument Details

+ **db**
  + connected mongo database instance

#### Method deleteRecord

Delete a matching Meter record

```ts
async deleteRecord(txid: string, outputIndex: number): Promise<void> 
```

Argument Details

+ **txid**
  + transaction id
+ **outputIndex**
  + Output index of the UTXO

#### Method findAll

Returns all results tracked by the overlay

```ts
async findAll(): Promise<UTXOReference[]> 
```
See also: [UTXOReference](#interface-utxoreference)

Returns

returns matching UTXO references

#### Method storeRecord

Stores meter record

```ts
async storeRecord(txid: string, outputIndex: number, value: number, creatorIdentityKey: string): Promise<void> 
```

Argument Details

+ **txid**
  + transaction id
+ **outputIndex**
  + index of the UTXO
+ **value**
  + meter value to save

</details>

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

---
### Class: WisnaeMeterContract

```ts
export class WisnaeMeterContract extends SmartContract {
    @prop(true)
    count: bigint;
    @prop(true)
    nextOwnerIdentityKey: ByteString;
    @prop(true)
    creatorIdentityKey: ByteString;
    @prop(true)
    creatorSignature: ByteString;
    constructor(count: bigint, nextOwnerIdentityKey: ByteString, creatorIdentityKey: ByteString, creatorSignature: ByteString) 
    @method(SigHash.ANYONECANPAY_SINGLE)
    public incrementOnChain(creatorIdentityKey: ByteString) 
    @method()
    increment(): void 
    @method()
    setNextOwnerIdentityKey(creatorIdentityKey: ByteString): void 
    @method()
    wasNotMe(): void 
    @method(SigHash.ANYONECANPAY_SINGLE)
    public decrementOnChain(creatorIdentityKey: ByteString) 
    @method()
    decrement(): void 
}
```

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

---
