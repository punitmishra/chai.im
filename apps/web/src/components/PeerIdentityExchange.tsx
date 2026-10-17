'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
  createIdentityCard,
  generateWebLink,
  parseIdentityLink,
  computeSafetyNumberWithPeer,
  isValidIdentityKey,
  base64ToArray,
  type IdentityCard,
  type SafetyNumber,
} from '@/lib/crypto/peerIdentity';

interface PeerIdentityExchangeProps {
  isOpen: boolean;
  onClose: () => void;
  onContactAdded?: (contact: IdentityCard) => void;
}

type Tab = 'share' | 'add' | 'verify';

export function PeerIdentityExchange({ isOpen, onClose, onContactAdded }: PeerIdentityExchangeProps) {
  const [activeTab, setActiveTab] = useState<Tab>('share');
  const [myCard, setMyCard] = useState<IdentityCard | null>(null);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [addInput, setAddInput] = useState('');
  const [parsedContact, setParsedContact] = useState<IdentityCard | null>(null);
  const [parseError, setParseError] = useState('');
  const [safetyNumber, setSafetyNumber] = useState<SafetyNumber | null>(null);
  const [verifyPeerId, setVerifyPeerId] = useState('');

  const user = useAuthStore((state) => state.user);

  // Generate my identity card on mount
  useEffect(() => {
    if (isOpen && user) {
      createIdentityCard(user.username || 'Unknown', user.id)
        .then((card) => {
          setMyCard(card);
          setShareLink(generateWebLink(card));
        })
        .catch(console.error);
    }
  }, [isOpen, user]);

  // Parse add input when it changes
  useEffect(() => {
    if (!addInput.trim()) {
      setParsedContact(null);
      setParseError('');
      return;
    }

    try {
      const card = parseIdentityLink(addInput);
      if (card && isValidIdentityKey(card.identityKey)) {
        setParsedContact(card);
        setParseError('');
      } else {
        setParsedContact(null);
        setParseError('Invalid identity link');
      }
    } catch {
      setParsedContact(null);
      setParseError('Could not parse identity link');
    }
  }, [addInput]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('Failed to copy to clipboard');
    }
  }, [shareLink]);

  const handleAddContact = useCallback(() => {
    if (parsedContact) {
      onContactAdded?.(parsedContact);
      setAddInput('');
      setParsedContact(null);
      onClose();
    }
  }, [parsedContact, onContactAdded, onClose]);

  const handleVerifySafetyNumber = useCallback(async () => {
    if (!verifyPeerId.trim()) return;

    try {
      // For demo purposes, using a placeholder key
      // In real usage, this would fetch the peer's identity key
      const peerKey = base64ToArray(verifyPeerId);
      const number = await computeSafetyNumberWithPeer(peerKey);
      setSafetyNumber(number);
    } catch {
      setSafetyNumber(null);
    }
  }, [verifyPeerId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-dark-900 rounded-2xl border border-dark-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700">
          <h2 className="text-lg font-semibold text-white">Identity Exchange</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-dark-700">
          {(['share', 'add', 'verify'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab === 'share' && 'Share My Identity'}
              {tab === 'add' && 'Add Contact'}
              {tab === 'verify' && 'Verify Contact'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Share Tab */}
          {activeTab === 'share' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Share this link with people you want to chat with. They can add you as a contact securely.
              </p>

              {myCard && (
                <>
                  {/* Identity Preview */}
                  <div className="p-4 bg-dark-800/50 rounded-xl border border-dark-600">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center">
                        <span className="text-xl text-cyan-400">
                          {myCard.username[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-white">{myCard.username}</p>
                        <p className="text-xs text-slate-500 font-mono">
                          {myCard.identityKey.slice(0, 16)}...
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Link */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shareLink}
                      readOnly
                      className="flex-1 px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-slate-300 font-mono"
                    />
                    <button
                      onClick={handleCopyLink}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        copied
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-cyan-500 text-black hover:bg-cyan-400'
                      }`}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>

                  {/* QR Code Placeholder */}
                  <div className="flex justify-center">
                    <div className="w-48 h-48 bg-dark-800 rounded-xl border border-dark-600 flex items-center justify-center">
                      <div className="text-center text-slate-500 text-sm">
                        <svg className="w-12 h-12 mx-auto mb-2 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                        <p>QR Code</p>
                        <p className="text-xs text-slate-600">Coming soon</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Add Tab */}
          {activeTab === 'add' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Paste an identity link shared by someone to add them as a contact.
              </p>

              <textarea
                value={addInput}
                onChange={(e) => setAddInput(e.target.value)}
                placeholder="Paste identity link here (e.g., https://chai.im/add?...)"
                className="w-full h-24 px-4 py-3 bg-dark-800 border border-dark-600 rounded-xl text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-cyan-500"
              />

              {parseError && (
                <p className="text-sm text-red-400">{parseError}</p>
              )}

              {parsedContact && (
                <div className="p-4 bg-dark-800/50 rounded-xl border border-dark-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-white">{parsedContact.username}</p>
                        <p className="text-xs text-slate-500">Valid identity key</p>
                      </div>
                    </div>
                    <button
                      onClick={handleAddContact}
                      className="px-4 py-2 bg-cyan-500 text-black font-medium rounded-lg hover:bg-cyan-400 transition-colors"
                    >
                      Add Contact
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Verify Tab */}
          {activeTab === 'verify' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Verify a contact's identity by comparing safety numbers. Both parties should see the same number.
              </p>

              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Contact's Identity Key (Base64)
                </label>
                <input
                  type="text"
                  value={verifyPeerId}
                  onChange={(e) => setVerifyPeerId(e.target.value)}
                  placeholder="Paste identity key..."
                  className="w-full px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                onClick={handleVerifySafetyNumber}
                disabled={!verifyPeerId.trim()}
                className="w-full py-2 bg-cyan-500 text-black font-medium rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate Safety Number
              </button>

              {safetyNumber && (
                <div className="p-4 bg-dark-800/50 rounded-xl border border-dark-600 space-y-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span className="font-medium text-white">Safety Number</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 font-mono text-center">
                    {safetyNumber.numeric.split(' ').map((group, i) => (
                      <span
                        key={i}
                        className="py-1 px-2 bg-dark-900 rounded text-sm text-cyan-300"
                      >
                        {group}
                      </span>
                    ))}
                  </div>

                  <p className="text-xs text-slate-500 text-center">
                    Fingerprint: <span className="font-mono text-slate-400">{safetyNumber.fingerprint}</span>
                  </p>

                  <p className="text-xs text-slate-500">
                    Compare this number with your contact in person or via another trusted channel.
                    If the numbers match, your conversation is secure.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PeerIdentityExchange;
