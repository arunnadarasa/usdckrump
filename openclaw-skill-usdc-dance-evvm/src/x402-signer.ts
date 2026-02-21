/**
 * x402 Protocol (EIP-3009) Signature Generator
 */

import { ethers } from 'ethers';

export interface X402SignatureOptions {
  from: string;
  to: string;
  amount: string;
  validAfter: number;
  validBefore: number;
  nonce: string; // bytes32
  usdcDanceAddress: string;
  chainId: number;
  privateKey: string;
}

export interface X402Signature {
  v: number;
  r: string;
  s: string;
  domainSeparator: string;
  structHash: string;
  digest: string;
}

const TRANSFER_WITH_AUTHORIZATION_TYPEHASH = ethers.keccak256(
  ethers.toUtf8Bytes('TransferWithAuthorization(address from,address to,uint256 amount,uint256 validAfter,uint256 validBefore,bytes32 nonce)')
);

const DOMAIN_TYPEHASH = ethers.keccak256(
  ethers.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
);

/**
 * Generate EIP-3009 signature for x402 protocol
 */
export async function generateX402Signature(
  options: X402SignatureOptions
): Promise<X402Signature> {
  const {
    from,
    to,
    amount,
    validAfter,
    validBefore,
    nonce,
    usdcDanceAddress,
    chainId,
    privateKey
  } = options;

  const signer = new ethers.Wallet(privateKey);

  // Build struct hash
  const structHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'bytes32'],
      [TRANSFER_WITH_AUTHORIZATION_TYPEHASH, from, to, amount, validAfter, validBefore, nonce]
    )
  );

  // Build domain separator
  const domainSeparator = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        DOMAIN_TYPEHASH,
        ethers.keccak256(ethers.toUtf8Bytes('USDC Dance')),
        ethers.keccak256(ethers.toUtf8Bytes('1')),
        chainId,
        usdcDanceAddress
      ]
    )
  );

  // Build digest (EIP-712)
  const digest = ethers.keccak256(
    ethers.concat([
      ethers.toUtf8Bytes('\x19\x01'),
      domainSeparator,
      structHash
    ])
  );

  // Sign digest
  const signature = await signer.signMessage(ethers.getBytes(digest));
  const sig = ethers.Signature.from(signature);

  return {
    v: sig.v,
    r: sig.r,
    s: sig.s,
    domainSeparator,
    structHash,
    digest
  };
}
