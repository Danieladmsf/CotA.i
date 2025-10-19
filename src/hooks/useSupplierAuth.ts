'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { Fornecedor } from '@/types';

const SESSION_KEY_PREFIX = 'supplier_auth_';
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

interface SupplierAuthSession {
  supplierId: string;
  timestamp: number;
  pinHash: string;
}

// Simple hash function for PIN (using SHA-256)
const hashPin = async (pin: string): Promise<string> => {
  try {
    // Try using Web Crypto API first (works in HTTPS and localhost)
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(pin);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.warn('Web Crypto API not available, using fallback hash');
  }

  // Fallback: Simple hash for development (not cryptographically secure, but works)
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
};

export const useSupplierAuth = (supplierId: string) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [supplier, setSupplier] = useState<Fornecedor | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);

  // Check if there's a valid session
  useEffect(() => {
    const checkSession = () => {
      const sessionKey = `${SESSION_KEY_PREFIX}${supplierId}`;
      const sessionData = localStorage.getItem(sessionKey);

      if (sessionData) {
        try {
          const session: SupplierAuthSession = JSON.parse(sessionData);
          const now = Date.now();

          // Check if session is still valid
          if (now - session.timestamp < SESSION_DURATION) {
            setIsAuthenticated(true);
            setIsLoading(false);
            return;
          } else {
            // Session expired, remove it
            localStorage.removeItem(sessionKey);
          }
        } catch (error) {
          console.error('Error parsing session data:', error);
          localStorage.removeItem(sessionKey);
        }
      }

      // No valid session, need to authenticate
      setShowPinModal(true);
      setIsLoading(false);
    };

    checkSession();
  }, [supplierId]);

  // Load supplier data
  useEffect(() => {
    const loadSupplier = async () => {
      try {
        const supplierDoc = await getDoc(doc(db, 'fornecedores', supplierId));

        if (supplierDoc.exists()) {
          const supplierData = { id: supplierDoc.id, ...supplierDoc.data() } as Fornecedor;
          setSupplier(supplierData);
        } else {
          console.error('Supplier not found');
        }
      } catch (error) {
        console.error('Error loading supplier:', error);
      }
    };

    if (supplierId) {
      loadSupplier();
    }
  }, [supplierId]);

  const verifyPin = async (pin: string): Promise<boolean> => {
    if (!supplier || !supplier.pin) {
      console.error('Supplier or PIN not found');
      return false;
    }

    try {
      const inputHash = await hashPin(pin);

      if (inputHash === supplier.pin) {
        // PIN is correct, create session
        const session: SupplierAuthSession = {
          supplierId,
          timestamp: Date.now(),
          pinHash: inputHash
        };

        const sessionKey = `${SESSION_KEY_PREFIX}${supplierId}`;
        localStorage.setItem(sessionKey, JSON.stringify(session));

        setIsAuthenticated(true);
        setShowPinModal(false);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error verifying PIN:', error);
      return false;
    }
  };

  const logout = () => {
    const sessionKey = `${SESSION_KEY_PREFIX}${supplierId}`;
    localStorage.removeItem(sessionKey);
    setIsAuthenticated(false);
    setShowPinModal(true);
  };

  return {
    isAuthenticated,
    isLoading,
    supplier,
    showPinModal,
    verifyPin,
    logout
  };
};
