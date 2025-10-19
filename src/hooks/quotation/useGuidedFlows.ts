/**
 * useGuidedFlows Hook
 *
 * Manages guided flow states for vendor flow, new brand flow, and wizard state.
 * Handles step-by-step interactions for supplier quotation portal.
 */

import { useState, useCallback } from 'react';

// Types
type PackagingType = 'caixa' | 'fardo' | 'granel' | '';

interface VendorFlowState {
  isActive: boolean;
  currentStep: number;
  selectedBrand: string;
  packagingType: PackagingType;
  unitsPerPackage: number;
  packageWeight: number;
  packagePrice: number;
  requiredPackages: number;
  showGuidedFlow: boolean;
}

interface NewBrandFlowState {
  isActive: boolean;
  currentStep: number;
  brandName: string;
  packagingType: PackagingType;
  unitsPerPackage: number;
  packageWeight: number;
  packagePrice: number;
  requiredPackages: number;
  imageFile: File | null;
  showGuidedFlow: boolean;
}

interface WizardState {
  isActive: boolean;
  currentStep: number;
  selectedBrand: string;
  packagingType: PackagingType;
  unitsPerPackage: number;
  packageWeight: number;
  packagePrice: number;
  requiredPackages: number;
}

export function useGuidedFlows() {
  // Vendor flow state
  const [vendorFlow, setVendorFlow] = useState<Record<string, VendorFlowState>>({});

  // New brand flow state
  const [newBrandFlow, setNewBrandFlow] = useState<Record<string, NewBrandFlowState>>({});

  // Wizard state
  const [wizardState, setWizardState] = useState<Record<string, WizardState>>({});

  // Vendor flow handlers
  const startVendorFlow = useCallback((productId: string, brandName: string) => {
    const flowKey = `${productId}_vendor_flow`;
    setVendorFlow(prev => ({
      ...prev,
      [flowKey]: {
        isActive: true,
        currentStep: 1,
        selectedBrand: brandName,
        packagingType: '',
        unitsPerPackage: 0,
        packageWeight: 0,
        packagePrice: 0,
        requiredPackages: 0,
        showGuidedFlow: true,
      }
    }));
  }, []);

  const updateVendorFlow = useCallback((
    productId: string,
    field: keyof VendorFlowState,
    value: any,
    nextStep?: number
  ) => {
    const flowKey = `${productId}_vendor_flow`;
    setVendorFlow(prev => {
      const updated = {
        ...prev,
        [flowKey]: {
          ...prev[flowKey],
          [field]: value,
          ...(nextStep && { currentStep: nextStep })
        }
      };
      return updated;
    });
  }, []);

  const cancelVendorFlow = useCallback((productId: string) => {
    const flowKey = `${productId}_vendor_flow`;
    setVendorFlow(prev => {
      const newFlow = { ...prev };
      delete newFlow[flowKey];
      return newFlow;
    });
  }, []);

  // New brand flow handlers
  const startNewBrandFlow = useCallback((productId: string) => {
    const flowKey = `${productId}_brand_flow`;
    setNewBrandFlow(prev => ({
      ...prev,
      [flowKey]: {
        isActive: true,
        currentStep: 1,
        brandName: '',
        packagingType: '',
        unitsPerPackage: 0,
        packageWeight: 0,
        packagePrice: 0,
        requiredPackages: 0,
        imageFile: null,
        showGuidedFlow: true,
      }
    }));
  }, []);

  const updateNewBrandFlow = useCallback((
    productId: string,
    field: keyof NewBrandFlowState,
    value: any,
    nextStep?: number
  ) => {
    const flowKey = `${productId}_brand_flow`;
    setNewBrandFlow(prev => ({
      ...prev,
      [flowKey]: {
        ...prev[flowKey],
        [field]: value,
        ...(nextStep && { currentStep: nextStep })
      }
    }));
  }, []);

  const cancelNewBrandFlow = useCallback((productId: string) => {
    const flowKey = `${productId}_brand_flow`;
    setNewBrandFlow(prev => {
      const newFlow = { ...prev };
      delete newFlow[flowKey];
      return newFlow;
    });
  }, []);

  // Wizard handlers
  const startWizard = useCallback((productId: string) => {
    setWizardState(prev => ({
      ...prev,
      [productId]: {
        isActive: true,
        currentStep: 1,
        selectedBrand: '',
        packagingType: '',
        unitsPerPackage: 0,
        packageWeight: 0,
        packagePrice: 0,
        requiredPackages: 0,
      }
    }));
  }, []);

  const updateWizard = useCallback((
    productId: string,
    field: keyof WizardState,
    value: any
  ) => {
    setWizardState(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value,
      }
    }));
  }, []);

  const cancelWizard = useCallback((productId: string) => {
    setWizardState(prev => {
      const newState = { ...prev };
      delete newState[productId];
      return newState;
    });
  }, []);

  return {
    // Vendor flow
    vendorFlow,
    startVendorFlow,
    updateVendorFlow,
    cancelVendorFlow,

    // New brand flow
    newBrandFlow,
    startNewBrandFlow,
    updateNewBrandFlow,
    cancelNewBrandFlow,

    // Wizard
    wizardState,
    startWizard,
    updateWizard,
    cancelWizard,
  };
}
