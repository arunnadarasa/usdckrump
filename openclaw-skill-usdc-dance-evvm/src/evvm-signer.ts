/**
 * EVVM Core EIP-191 Signature Generator
 */

import { ethers } from 'ethers';

export interface EVVMSignatureOptions {
  from: string;
  to: string;
  toIdentity: string;
  token: string;
  amount: string;
  priorityFee: number;
  senderExecutor: string;
  nonce: bigint;
  isAsyncExec: boolean;
  evvmId: number;
  evvmCoreAddress: string;
  privateKey: string;
}

export interface EVVMSignature {
  signature: string;
  hashPayload: string;
}

/**
 * Generate EVVM Core payment signature (EIP-191)
 * 
 * EVVM signature format: keccak256(evvmId, serviceAddress, hashPayload, executor, nonce, isAsyncExec)
 * hashPayload = keccak256(abi.encode(to_address, to_identity, token, amount, priorityFee))
 */
export async function generateEVVMSignature(
  options: EVVMSignatureOptions
): Promise<EVVMSignature> {
  const {
    from,
    to,
    toIdentity,
    token,
    amount,
    priorityFee,
    senderExecutor,
    nonce,
    isAsyncExec,
    evvmId,
    evvmCoreAddress,
    privateKey
  } = options;

  const signer = new ethers.Wallet(privateKey);

  // Build hashPayload (CoreHashUtils.hashDataForPay)
  const hashPayload = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'string', 'address', 'uint256', 'uint256'],
      [to, toIdentity, token, amount, priorityFee]
    )
  );

  // Build signature payload: {evvmId},{serviceAddress},{hashPayload},{executor},{nonce},{isAsyncExec}
  const signaturePayload = ethers.AbiCoder.defaultAbiCoder().encode(
    ['uint256', 'address', 'bytes32', 'address', 'uint256', 'bool'],
    [evvmId, evvmCoreAddress, hashPayload, senderExecutor, nonce, isAsyncExec]
  );

  // EIP-191: "\x19Ethereum Signed Message:\n32" + keccak256(payload)
  const messageHash = ethers.keccak256(signaturePayload);
  const ethSignedMessage = ethers.solidityPacked(
    ['string', 'bytes32'],
    ['\x19Ethereum Signed Message:\n32', messageHash]
  );

  const digest = ethers.keccak256(ethSignedMessage);
  const signature = await signer.signMessage(ethers.getBytes(digest));

  return {
    signature,
    hashPayload
  };
}
