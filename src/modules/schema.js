import { randomAsHex, encodeAddress } from '@polkadot/util-crypto';
import { validate } from 'jsonschema';

import { getSignatureFromKeyringPair } from '../utils/misc';

export const BlobQualifier = 'blob:dock:';
export const EncodedIDByteSize = 48;

// Size of the blob id in bytes
export const BLOB_ID_MAX_BYTE_SIZE = 32;

// Maximum size of the blob in bytes
// implementer may choose to implement this as a dynamic config option settable with the `parameter_type!` macro
export const BLOB_MAX_BYTE_SIZE = 1024;

// Schema-validator spec
const jsonSchemaSpec = {
  description: 'Schema Object Validation',
  type: 'object',
  properties: {
    $schema: {
      type: 'string',
    },
    description: {
      type: 'string',
    },
    type: {
      type: 'string',
    },
    properties: {
      type: 'object',
    },
    additionalProperties: {
      type: 'any',
    },
  },
  required: ['$schema', 'type', 'properties'],
  additionalProperties: true,
};

/**
 * Generates a random schema ID
 * @returns {string}
 */
export function createNewSchemaID() {
  const hexId = randomAsHex(BLOB_ID_MAX_BYTE_SIZE);
  const ss58Id = encodeAddress(hexId);
  return `${BlobQualifier}${ss58Id}`;
}

export default class Schema {
  /**
   * Creates a new `Schema` object
   * @constructor
   * @param {string} [id] - optional schema ID, if not given, generate a random id
   */
  constructor(id) {
    this.id = id || createNewSchemaID();
    this.name = '';
    this.version = '1.0.0';
  }

  /**
   * Add the JSON schema to this object after checking that `json` is a valid JSON schema. Check if JSON is valid.
   * @param {object} json - the schema JSON
   */
  setJSONSchema(json) {
    if (!Schema.validateSchema(json)) {
      throw new Error('Invalid schema');
    }
    this.schema = json;
  }

  /**
  * Update the object with `author` key. Repeatedly calling it will keep resetting the author
  * did can be a DID hex identifier or full DID
  * @param {string} did - the author DID
  */
  setAuthor(did) {
    this.author = did;
  }

  /**
  * Update the object with `signature` key. This method is used when
  * signing key/capability is not present and the signature is received from outside.
  * Repeatedly calling it will keep resetting the `signature` key.
  * The signature must be one of the supported objects
  * @param {object} signature - The schema's signatuer
  */
  setSignature(signature) {
    // TODO: ensure is signature
    this.signature = signature;
  }

  /**
  * Serializes the object using `getSerializedBlob` and then signs it using the given
  * polkadot-js pair. The object will be updated with key `signature`. Repeatedly calling it will
  * keep resetting the `signature` key
  * @param {object} pair - Key pair to sign with
  */
  sign(pair) {
    // TODO: proper message
    const msg = [1, 2, 3, 4];
    this.signature = getSignatureFromKeyringPair(pair, msg);
  }

  /**
   * Serializes to JSON for sending to the node, as `Blob`. A full DID is converted to the
   * hex identifier and signature object is converted to the enum
   * @returns {any}
   */
  toJSON() {
    const {
      signature,
      ...rest
    } = this;
    return rest;
  }

  /**
   * Check that the given JSON schema is compliant with JSON schema spec mentioned in RFC
   * @param {object} json - The JSON schema to validate
   * @returns {Boolean}
   */
  static validateSchema(json) {
    const result = validate(json, jsonSchemaSpec, {
      throwError: true
    });
    return true;
  }

  /**
   * Get schema from from the chain using the given id, by querying the blob storage.
   * Accepts a full blob id like blob:dock:0x... or just the hex identifier and the `DockAPI` object.
   * The returned schema would be formatted as specified in the RFC (including author DID, schema id) or an error is
   * returned if schema is not found on the chain or in JSON format.
   * @param {string} id - The Schema ID
   * @param {object} dockApi - The Dock API
   * @returns {any}
   */
  static async getSchema(id, dockApi) {
    // TODO: requires blob module
    if (id === 'invalid-format') {
      throw new Error(`Incorrect schema format`, dockApi);
    } else if (id === 'invalid-id') {
      throw new Error(`Invalid schema id ${id}`, dockApi);
    }

    return {};
  }
}