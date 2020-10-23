// This example shows two ways to anchor content, Direct and Merklized.
//
// The first, direct anchoring, places the content directly into a transaction. This method makes
// the content public and immutable but direct anchors become expensive to post as content becomes
// large. Direct anchors are also costly to post in bulk (i.e. anchoring multiple documents).
//
// It's advised to hash documents in order to keep anchoring price constant irrespective of document size.
// It's advised to batch document hashes into a merkle tree to keep anchoring price constant
// irrespective of document count.
//
// A potential downside to merkle batching is that PoE verification of each batched document will
// require a merkle proof of inclusion. This is a tradeoff to consider when designing for your use
// case. Merkleized anchors can batch infinite anchors into a single, fixed cost transaction, but
// verification requires a proof.
//
// This example uses mrklt for merkle tree construction. A mrklt tree containing exactly one
// document will have `root = hash(hash(document))` and the merkle proof for that document will be
// an empty list `[]`. `verify_proof(hash(document), []) = root = hash(hash(document))`. In other
// words, when batch size is 1, we can infer `proof = []`.
//
// It is possible simply post `hash(document)` as an anchor, but it's recommended to double-hash
// the document instead. Since `hash(hash(document)) = compute_root(hash(document))` a double-hashed
// anchor can be interpreted as the root of a merkle-tree with 1 leaf. Since the merkle tree has
// only one leaf, the proof of inclusion for that leaf will be empty.

import { compute_root, create_proof, verify_proof } from 'mrklt';
import assert from 'assert';
import { connect, keypair } from '../scripts/helpers';
import BLAKE2s from 'blake2s-js';
import { randomAsU8a } from '@polkadot/util-crypto';
import { u8aToHex } from '@polkadot/util';

require('dotenv').config();
const { FullNodeEndpoint, TestAccountURI } = process.env;
let conn = connect(FullNodeEndpoint);

// Post a value to the anchors module.
async function anchor(hash) {
  const nc = await conn;
  await sendExtrinsic(
    await signExtrinsic(
      nc.tx.anchor.deploy(u8aToHex(hash))
    )
  );
}

// Check to see at which block a value was anchored. Return the block when the hash was
// anchored. If the value is not anchored, return null.
async function check(hash) {
  const nc = await conn;
  await nc.query.anchor.anchors(u8aToHex(hash));
  unimplemented();
}

// Anchor a list of hashes to the chain as a batch. Return merkle proofs for each anchor
// in the order they we submitted.
//
// This function will fail if the input is an empty list.
async function anchorBatched(leafHashes) {
  const pl = pack32(leafHashes); // pl stands for packed leaves
  const ret = leafHashes.map((_, i) => create_proof(i, pl));
  const root = compute_root(pl);
  await anchor(root);
  return ret;
}

// Check a single hash from a batch.
//
// Check a hash against its merkle proof to find when its parent merkle tree root was anchored.
// If the merkle root was never anchored, return null.
async function checkBatched(hash, proof) {
  const root = verify_proof(hash, proof);
  return await check(root);
}

// encode a string as utf8
function utf8(str) {
  return new TextEncoder("utf-8").encode(str);
}

// hash a byte array using blake2s-256
function blake2s(bs) {
  let h = new BLAKE2s();
  h.update(bs);
  return h.digest();
}

// pack a list of hashed leaves into a single byte array
function pack32(leaves) {
  for (const leaf of leaves) {
    assert(leaf instanceof Uint8Array);
    assert(leaf.length == 32);
  }
  let ret = new Uint8Array(leaves.map(a => [...a]).flat());
  assert(ret.length === leaves.length * 32);
  return ret;
}

async function main() {
  // batched
  const docHashes = [
    utf8('{"example": "document"}'),
    utf8('{"example": 2}'),
    randomAsU8a(),
    utf8('{"example": 4}'),
  ].map(blake2s);
  const proofs = await anchorBatched(docHashes);
  assert(await checkBatched(docHashes[0], proofs[0]) !== null);
  assert(await checkBatched(docHashes[0], proofs[1]) === null);

  // single
  const single = blake2s(randomAsU8a());
  assert(await checkBatched(single, []) === null);
  await anchorBatched([single]);
  assert(await checkBatched(single, []) !== null);
}

// MUTATING
// sign extrinsic as test account
async function signExtrinsic(extrinsic) {
  const key = await keypair(TestAccountURI);
  await extrinsic.signAsync(key);
  return extrinsic;
}

// submit extrinsic and wait for it to finalize
async function sendExtrinsic(extrinsic) {
  return await new Promise((resolve, reject) => {
    try {
      let unsubFunc = null;
      return extrinsic.send(({ events = [], status }) => {
        if (status.isInBlock) {
          unsubFunc();
          resolve({
            events,
            status,
          });
        }
      })
        .catch((error) => {
          reject(error);
        })
        .then((unsub) => {
          unsubFunc = unsub;
        });
    } catch (error) {
      reject(error);
    }
    return this;
  });
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
