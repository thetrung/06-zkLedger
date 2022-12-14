import {
  Field,
  Struct,
  Poseidon,
  PublicKey,
  Bool,
  CircuitString,
} from 'snarkyjs';
import { encrypt_password, decrypt_mnemonic, init_vector } from 'tezallet';

export class Account extends Struct({
  publicKey: PublicKey,
  vector: CircuitString,
  mnemonic: CircuitString,
  password: CircuitString,
  isActivated: Bool,
}) {
  constructor(
    publicKey: PublicKey,
    key?: CircuitString,
    password?: CircuitString,
    isActivated?: Bool,
    vector?: CircuitString
  ) {
    const _v = init_vector().toString('base64');
    console.log(_v);
    const empty_circle = CircuitString.fromString('');
    const vector_init = CircuitString.fromString(_v);
    super({
      publicKey,
      vector: vector || vector_init,
      mnemonic: key || empty_circle,
      password: password || empty_circle,
      isActivated: isActivated || Bool.not(true),
    });
    this.publicKey = publicKey;
    this.vector = vector || vector_init;
    this.mnemonic = key || empty_circle;
    this.password = password || empty_circle;
    this.isActivated = isActivated || Bool.not(true);
  }
  /// Hash account
  hash(): Field {
    return Poseidon.hash(
      this.password
        .toFields()
        .concat(
          this.publicKey
            .toFields()
            .concat(this.mnemonic.toFields().concat(this.isActivated.toField()))
        )
    );
  }

  activate(password: CircuitString): Account {
    this.isActivated.assertFalse(
      '[Account/activate] account is already activated.'
    );
    return new Account(
      this.publicKey,
      this.mnemonic,
      password,
      Bool.not(false),
      this.vector
    );
  }
  v_buffer(): Buffer {
    return Buffer.from(this.vector.toString(), 'base64');
  }
  encrypt(password: CircuitString): CircuitString {
    // verify password :
    const publicKey = this.publicKey.toFields().toString();
    // encrypt password
    const pbkdf2_password = encrypt_password(
      password.toString(),
      publicKey,
      16
    );
    const fieldPassword = CircuitString.fromString(pbkdf2_password);
    return fieldPassword;
  }
  verify(password: CircuitString, proofs: Field) {
    const givenHash = Poseidon.hash(password.toFields().concat(proofs));
    const originHash = Poseidon.hash(
      this.password.toFields().concat(this.hash())
    );
    originHash.assertEquals(givenHash);
    password.assertEquals(this.password);
  }
  setKey(newKey: CircuitString, password: CircuitString): Account {
    // is activated ?
    this.isActivated.assertTrue();
    // return new version :
    let newAccount = new Account(
      this.publicKey,
      newKey,
      password,
      this.isActivated,
      this.vector
    );
    return newAccount;
  }
  revealKey(password: CircuitString): string {
    // is activated ?
    this.isActivated.assertTrue();
    // encrypt password
    const fieldPassword = this.encrypt(password);
    // reveal key
    const revealedKey = decrypt_mnemonic(
      this.mnemonic.toString(),
      fieldPassword.toString(),
      this.v_buffer()
    );
    return revealedKey;
  }
}
