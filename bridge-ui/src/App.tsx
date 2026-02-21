import { useState, useEffect, useCallback } from 'react';
import { BrowserProvider, JsonRpcProvider, Contract, formatUnits, parseUnits, zeroPadValue } from 'ethers';
import { BASE_SEPOLIA, STORY_AENEID, CONTRACTS, USDC_DECIMALS, STREETKODE_LINK } from './config';
import { ERC20_ABI, BRIDGE_VAULT_ABI, BRIDGE_RECEIVER_ABI, USDCKRUMP_OFT_ABI } from './abis';

type BridgeType = 'custom' | 'layerzero';
type Direction = 'usdc-to-usdck' | 'usdck-to-usdc';

declare global {
  interface Window {
    ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
  }
}

function App() {
  const [bridgeType, setBridgeType] = useState<BridgeType>('custom');
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [direction, setDirection] = useState<Direction>('usdc-to-usdck');
  const [balance, setBalance] = useState<string>('0');
  const [amount, setAmount] = useState('');
  const [customRecipient, setCustomRecipient] = useState('');
  const [useCustomRecipient, setUseCustomRecipient] = useState(false);
  const [status, setStatus] = useState<'idle' | 'approving' | 'locking' | 'sending' | 'success' | 'error'>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lzFee, setLzFee] = useState<string | null>(null);

  const walletProvider = typeof window !== 'undefined' && window.ethereum
    ? new BrowserProvider(window.ethereum)
    : null;
  const baseProvider = new JsonRpcProvider(BASE_SEPOLIA.rpcUrl);
  const storyProvider = new JsonRpcProvider(STORY_AENEID.rpcUrl);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setErrorMessage('No wallet found. Install MetaMask or another Web3 wallet.');
      return;
    }
    try {
      const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      const chainIdHex = (await window.ethereum.request({ method: 'eth_chainId' })) as string;
      setAccount(accounts[0] ?? null);
      setChainId(chainIdHex ? parseInt(chainIdHex, 16) : null);
      setErrorMessage(null);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Failed to connect');
    }
  }, []);

  const switchToBaseSepolia = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_SEPOLIA.chainIdHex }],
      });
    } catch (e: unknown) {
      const err = e as { code?: number };
      if (err?.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: BASE_SEPOLIA.chainIdHex,
            chainName: BASE_SEPOLIA.name,
            rpcUrls: [BASE_SEPOLIA.rpcUrl],
            blockExplorerUrls: [BASE_SEPOLIA.blockExplorer],
          }],
        });
      }
    }
  }, []);

  const switchToStoryAeneid = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: STORY_AENEID.chainIdHex }],
      });
    } catch (e: unknown) {
      const err = e as { code?: number };
      if (err?.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: STORY_AENEID.chainIdHex,
            chainName: STORY_AENEID.name,
            rpcUrls: [STORY_AENEID.rpcUrl],
            blockExplorerUrls: [STORY_AENEID.blockExplorer],
          }],
        });
      }
    }
  }, []);

  const fetchBalance = useCallback(async () => {
    if (!account) {
      setBalance('0');
      return;
    }
    try {
      if (bridgeType === 'custom') {
        if (direction === 'usdc-to-usdck' && chainId === BASE_SEPOLIA.chainId) {
          const usdc = new Contract(CONTRACTS.baseSepolia.usdc, ERC20_ABI, baseProvider);
          const raw = await usdc.balanceOf(account);
          setBalance(formatUnits(raw, USDC_DECIMALS));
        } else if (direction === 'usdck-to-usdc' && chainId === STORY_AENEID.chainId) {
          const usdck = new Contract(CONTRACTS.storyAeneid.bridgeUsdc, ERC20_ABI, storyProvider);
          const raw = await usdck.balanceOf(account);
          setBalance(formatUnits(raw, USDC_DECIMALS));
        } else {
          setBalance('0');
        }
      } else {
        // LayerZero OFT - OAppProxyOFT wraps USDC, so check USDC balance
        if (chainId === BASE_SEPOLIA.chainId) {
          // On Base Sepolia, OAppProxyOFT wraps standard USDC
          const usdc = new Contract(CONTRACTS.baseSepolia.usdc, ERC20_ABI, baseProvider);
          const raw = await usdc.balanceOf(account);
          setBalance(formatUnits(raw, USDC_DECIMALS));
        } else if (chainId === STORY_AENEID.chainId) {
          // On Story Aeneid, OAppProxyOFT wraps wrapped USDC
          const wrappedUsdc = new Contract(CONTRACTS.storyAeneid.wrappedUsdc, ERC20_ABI, storyProvider);
          const raw = await wrappedUsdc.balanceOf(account);
          setBalance(formatUnits(raw, USDC_DECIMALS));
        } else {
          setBalance('0');
        }
      }
    } catch {
      setBalance('0');
    }
  }, [account, chainId, direction, bridgeType]);

  // Fetch LayerZero fee when amount changes
  useEffect(() => {
    if (bridgeType === 'layerzero' && account && amount && parseFloat(amount) > 0) {
      const fetchFee = async () => {
        try {
          const recipient = useCustomRecipient && customRecipient.trim() ? customRecipient.trim() : account;
          const recipientBytes32 = zeroPadValue(recipient, 32);
          const amountWei = parseUnits(amount, USDC_DECIMALS);
          
          if (direction === 'usdc-to-usdck' && chainId === BASE_SEPOLIA.chainId) {
            // Base → Story
            const oft = new Contract(CONTRACTS.baseSepolia.oappProxyOft, USDCKRUMP_OFT_ABI, baseProvider);
            const sendParam = {
              dstEid: STORY_AENEID.layerZeroEid, // Story Aeneid EID
              to: recipientBytes32,
              amountLD: amountWei,
              minAmountLD: amountWei,
              extraOptions: '0x',
              composeMsg: '0x',
              oftCmd: '0x',
            };
            const [nativeFee] = await oft.quoteSend(sendParam, false);
            setLzFee(formatUnits(nativeFee, 18));
          } else if (direction === 'usdck-to-usdc' && chainId === STORY_AENEID.chainId) {
            // Story → Base
            const oft = new Contract(CONTRACTS.storyAeneid.oappProxyOft, USDCKRUMP_OFT_ABI, storyProvider);
            const sendParam = {
              dstEid: BASE_SEPOLIA.layerZeroEid, // Base Sepolia EID (40245, not chain ID)
              to: recipientBytes32,
              amountLD: amountWei,
              minAmountLD: amountWei,
              extraOptions: '0x',
              composeMsg: '0x',
              oftCmd: '0x',
            };
            const [nativeFee] = await oft.quoteSend(sendParam, false);
            setLzFee(formatUnits(nativeFee, 18));
          } else {
            setLzFee(null);
          }
        } catch {
          setLzFee(null);
        }
      };
      fetchFee();
    } else {
      setLzFee(null);
    }
  }, [bridgeType, account, chainId, direction, amount, useCustomRecipient, customRecipient]);

  useEffect(() => {
    if (!window.ethereum) return;
    const onAccounts = (p: unknown) => setAccount(Array.isArray(p) ? (p as string[])[0] ?? null : null);
    const onChain = (p: unknown) => setChainId(typeof p === 'string' ? parseInt(p, 16) : null);
    window.ethereum.request({ method: 'eth_accounts' }).then((accounts) => {
      const a = (accounts as string[])[0];
      if (a) setAccount(a);
    });
    window.ethereum.request({ method: 'eth_chainId' }).then((id) => setChainId(parseInt(id as string, 16)));
    (window.ethereum as { on?: (e: string, h: (p: unknown) => void) => void }).on?.('accountsChanged', onAccounts);
    (window.ethereum as { on?: (e: string, h: (p: unknown) => void) => void }).on?.('chainChanged', onChain);
    return () => {
      (window.ethereum as { removeListener?: (e: string, h: (p: unknown) => void) => void })?.removeListener?.('accountsChanged', onAccounts);
      (window.ethereum as { removeListener?: (e: string, h: (p: unknown) => void) => void })?.removeListener?.('chainChanged', onChain);
    };
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const recipient = useCustomRecipient && customRecipient.trim() ? customRecipient.trim() : account ?? '';
  
  // Required chain ID based on bridge type and direction
  const requiredChainId = bridgeType === 'layerzero'
    ? (direction === 'usdc-to-usdck' ? BASE_SEPOLIA.chainId : STORY_AENEID.chainId)
    : (direction === 'usdc-to-usdck' ? BASE_SEPOLIA.chainId : STORY_AENEID.chainId);
  
  const isWrongChain = chainId != null && chainId !== requiredChainId;
  const blockExplorer = chainId === BASE_SEPOLIA.chainId ? BASE_SEPOLIA.blockExplorer : STORY_AENEID.blockExplorer;

  const bridge = async () => {
    if (!walletProvider || !account) {
      setErrorMessage('Connect your wallet.');
      return;
    }
    if (chainId !== requiredChainId) {
      if (requiredChainId === BASE_SEPOLIA.chainId) {
        await switchToBaseSepolia();
      } else {
        await switchToStoryAeneid();
      }
      return;
    }

    const amountWei = (() => {
      try {
        return parseUnits(amount || '0', USDC_DECIMALS);
      } catch {
        return null;
      }
    })();
    if (!amountWei || amountWei === 0n) {
      setErrorMessage('Enter a valid amount.');
      return;
    }
    if (!recipient || recipient.length !== 42 || !recipient.startsWith('0x')) {
      setErrorMessage('Use your connected address or a valid custom recipient.');
      return;
    }

    setStatus('idle');
    setErrorMessage(null);
    setTxHash(null);

    try {
      const signer = await walletProvider.getSigner();

      if (bridgeType === 'custom') {
        // Custom bridge logic
        if (direction === 'usdc-to-usdck') {
          const usdc = new Contract(CONTRACTS.baseSepolia.usdc, ERC20_ABI, signer);
          const vault = new Contract(CONTRACTS.baseSepolia.bridgeVault, BRIDGE_VAULT_ABI, signer);
          const allowance = await usdc.allowance(account, CONTRACTS.baseSepolia.bridgeVault);
          if (allowance < amountWei) {
            setStatus('approving');
            const approveTx = await usdc.approve(CONTRACTS.baseSepolia.bridgeVault, amountWei);
            await approveTx.wait();
          }
          setStatus('locking');
          const lockTx = await vault.lock(amountWei, recipient);
          await lockTx.wait();
          setTxHash(lockTx.hash);
        } else {
          const usdck = new Contract(CONTRACTS.storyAeneid.bridgeUsdc, ERC20_ABI, signer);
          const receiver = new Contract(CONTRACTS.storyAeneid.bridgeReceiver, BRIDGE_RECEIVER_ABI, signer);
          const allowance = await usdck.allowance(account, CONTRACTS.storyAeneid.bridgeReceiver);
          if (allowance < amountWei) {
            setStatus('approving');
            const approveTx = await usdck.approve(CONTRACTS.storyAeneid.bridgeReceiver, amountWei);
            await approveTx.wait();
          }
          setStatus('locking');
          const lockTx = await receiver.lockBack(amountWei, recipient);
          await lockTx.wait();
          setTxHash(lockTx.hash);
        }
      } else {
        // LayerZero OFT logic - using OAppProxyOFT (wraps standard USDC)
        const recipientBytes32 = zeroPadValue(recipient, 32);
        
        if (direction === 'usdc-to-usdck') {
          // Base → Story
          // First approve USDC to OAppProxyOFT if needed
          const usdc = new Contract(CONTRACTS.baseSepolia.usdc, ERC20_ABI, signer);
          const oft = new Contract(CONTRACTS.baseSepolia.oappProxyOft, USDCKRUMP_OFT_ABI, signer);
          
          const allowance = await usdc.allowance(account, CONTRACTS.baseSepolia.oappProxyOft);
          if (allowance < amountWei) {
            setStatus('approving');
            const approveTx = await usdc.approve(CONTRACTS.baseSepolia.oappProxyOft, amountWei);
            await approveTx.wait();
          }
          
          const sendParam = {
            dstEid: STORY_AENEID.layerZeroEid, // Story Aeneid EID
            to: recipientBytes32,
            amountLD: amountWei,
            minAmountLD: amountWei,
            extraOptions: '0x',
            composeMsg: '0x',
            oftCmd: '0x',
          };

          const [nativeFee] = await oft.quoteSend(sendParam, false);
          const fee = {
            nativeFee,
            lzTokenFee: 0n,
          };

          setStatus('sending');
          const sendTx = await oft.send(sendParam, fee, account, { value: nativeFee });
          await sendTx.wait();
          setTxHash(sendTx.hash);
        } else {
          // Story → Base
          // First approve wrapped USDC to OAppProxyOFT if needed
          const wrappedUsdc = new Contract(CONTRACTS.storyAeneid.wrappedUsdc, ERC20_ABI, signer);
          const oft = new Contract(CONTRACTS.storyAeneid.oappProxyOft, USDCKRUMP_OFT_ABI, signer);
          
          const allowance = await wrappedUsdc.allowance(account, CONTRACTS.storyAeneid.oappProxyOft);
          if (allowance < amountWei) {
            setStatus('approving');
            const approveTx = await wrappedUsdc.approve(CONTRACTS.storyAeneid.oappProxyOft, amountWei);
            await approveTx.wait();
          }
          
          const sendParam = {
            dstEid: BASE_SEPOLIA.layerZeroEid, // Base Sepolia EID (40245, not chain ID)
            to: recipientBytes32,
            amountLD: amountWei,
            minAmountLD: amountWei,
            extraOptions: '0x',
            composeMsg: '0x',
            oftCmd: '0x',
          };

          const [nativeFee] = await oft.quoteSend(sendParam, false);
          const fee = {
            nativeFee,
            lzTokenFee: 0n,
          };

          setStatus('sending');
          const sendTx = await oft.send(sendParam, fee, account, { value: nativeFee });
          await sendTx.wait();
          setTxHash(sendTx.hash);
        }
      }

      setStatus('success');
      setAmount('');
      fetchBalance();
    } catch (e) {
      setStatus('error');
      setErrorMessage(e instanceof Error ? e.message : 'Transaction failed');
    }
  };

  const setMax = () => setAmount(balance);

  const canBridge = account && !isWrongChain && amount && recipient && parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(balance) && 
    (bridgeType === 'custom' || (bridgeType === 'layerzero' && lzFee !== null));

  return (
    <div className="app">
      <header className="header">
        <h1>USDC Bridge</h1>
        <p className="subtitle">Standard USDC ↔ USDC.k · Base Sepolia ↔ Story Aeneid</p>
      </header>

      <main className="bridge-card">
        <div className="bridge-type-tabs">
          <button
            type="button"
            className={bridgeType === 'custom' ? 'active' : ''}
            onClick={() => { setBridgeType('custom'); setAmount(''); setErrorMessage(null); }}
          >
            Custom Bridge
          </button>
          <button
            type="button"
            className={bridgeType === 'layerzero' ? 'active' : ''}
            onClick={() => { setBridgeType('layerzero'); setDirection('usdc-to-usdck'); setAmount(''); setErrorMessage(null); }}
          >
            LayerZero OFT
          </button>
        </div>

        <div className="direction-tabs">
          <button
            type="button"
            className={direction === 'usdc-to-usdck' ? 'active' : ''}
            onClick={() => { setDirection('usdc-to-usdck'); setAmount(''); setErrorMessage(null); }}
          >
            {bridgeType === 'custom' ? 'USDC → USDC.k' : 'Base → Story'}
          </button>
          <button
            type="button"
            className={direction === 'usdck-to-usdc' ? 'active' : ''}
            onClick={() => { setDirection('usdck-to-usdc'); setAmount(''); setErrorMessage(null); }}
          >
            {bridgeType === 'custom' ? 'USDC.k → USDC' : 'Story → Base'}
          </button>
        </div>

        <div className="from-card card">
          <span className="label">From</span>
          <div className="row chain-token">
            <span className="chain">
              {bridgeType === 'layerzero'
                ? (direction === 'usdc-to-usdck' ? BASE_SEPOLIA.name : STORY_AENEID.name)
                : (direction === 'usdc-to-usdck' ? BASE_SEPOLIA.name : STORY_AENEID.name)}
            </span>
            <span className="token">
              {bridgeType === 'layerzero'
                ? (direction === 'usdc-to-usdck' ? 'USDC' : 'USDC Krump (USDC.k)')
                : (direction === 'usdc-to-usdck' ? 'USDC' : 'USDC Krump (USDC.k)')}
            </span>
          </div>
          <div className="row input-row">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!account}
            />
            <button type="button" className="max-btn" onClick={setMax} disabled={!account}>
              Max
            </button>
          </div>
          <div className="row balance">Balance: {account ? balance : '—'}</div>
        </div>

        <div className="arrow">↓</div>

        <div className="to-card card">
          <span className="label">To</span>
          <div className="row chain-token">
            <span className="chain">
              {bridgeType === 'layerzero'
                ? (direction === 'usdc-to-usdck' ? STORY_AENEID.name : BASE_SEPOLIA.name)
                : (direction === 'usdc-to-usdck' ? STORY_AENEID.name : BASE_SEPOLIA.name)}
            </span>
            <span className="token">
              {bridgeType === 'layerzero'
                ? (direction === 'usdc-to-usdck' ? 'USDC Krump (USDC.k)' : 'USDC')
                : (direction === 'usdc-to-usdck' ? 'USDC Krump (USDC.k)' : 'USDC')}
            </span>
          </div>
          <div className="row amount-display">{amount || '0.0'}</div>
          {bridgeType === 'layerzero' && lzFee && (
            <div className="row fee-display" style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--muted)' }}>
              LayerZero Fee: ~{parseFloat(lzFee).toFixed(6)} {chainId === BASE_SEPOLIA.chainId ? 'ETH' : 'IP'}
            </div>
          )}
          <div className="recipient-section">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={useCustomRecipient}
                onChange={(e) => setUseCustomRecipient(e.target.checked)}
              />
              Custom recipient
            </label>
            {useCustomRecipient && (
              <input
                type="text"
                placeholder="0x..."
                value={customRecipient}
                onChange={(e) => setCustomRecipient(e.target.value)}
                className="recipient-input"
              />
            )}
          </div>
        </div>

        {isWrongChain && (
          <button
            type="button"
            className="btn primary switch-chain"
            onClick={requiredChainId === BASE_SEPOLIA.chainId ? switchToBaseSepolia : switchToStoryAeneid}
          >
            Switch to {requiredChainId === BASE_SEPOLIA.chainId ? BASE_SEPOLIA.name : STORY_AENEID.name}
          </button>
        )}
        {!account && (
          <button type="button" className="btn primary" onClick={connect}>
            Connect Wallet
          </button>
        )}
        {account && !isWrongChain && (
          <button
            type="button"
            className="btn primary"
            onClick={bridge}
            disabled={!canBridge || status === 'approving' || status === 'locking' || status === 'sending'}
          >
            {status === 'approving' ? 'Approving…' : 
             status === 'locking' ? 'Bridging…' : 
             status === 'sending' ? 'Sending via LayerZero…' : 
             'Bridge'}
          </button>
        )}

        {errorMessage && <p className="error">{errorMessage}</p>}
        {status === 'success' && txHash && (
          <p className="success-msg">
            Transaction sent.{' '}
            <a href={`${blockExplorer}/tx/${txHash}`} target="_blank" rel="noopener noreferrer">
              View on explorer
            </a>
            <br />
            <small>
              {bridgeType === 'layerzero'
                ? direction === 'usdc-to-usdck'
                  ? 'Funds will arrive on Story Aeneid as USDC.k via LayerZero (~1–2 min).'
                  : 'Funds will arrive on Base Sepolia as USDC via LayerZero (~1–2 min).'
                : direction === 'usdc-to-usdck'
                ? 'Funds will arrive on Story Aeneid as USDC.k after the relayer fulfills (~1–2 min).'
                : 'Funds will arrive on Base Sepolia as USDC after the relayer releases (~1–2 min).'}
            </small>
          </p>
        )}
      </main>

      <footer className="footer">
        Powered by{' '}
        <a href={STREETKODE_LINK} target="_blank" rel="noopener noreferrer">
          StreetKode Fam
        </a>
      </footer>
    </div>
  );
}

export default App;
