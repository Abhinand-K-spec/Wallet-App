'use client';

import { useState, useEffect } from 'react';
import api from '@/api/axios';
import { useDispatch } from 'react-redux';
import { addToast } from '@/store/toastSlice';
import {
  X,
  UploadCloud,
  FileImage,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  AlertCircle,
  Save,
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface PaymentProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  paymentRequestId: string;
  amountUSD: number;
  currency: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  walletAddress?: string;
  accountNumber?: string;
  utr?: string;
}

export default function PaymentProofModal({
  isOpen,
  onClose,
  onSuccess,
  paymentRequestId,
  amountUSD,
  currency,
  type,
  walletAddress,
  accountNumber,
  utr
}: PaymentProofModalProps) {
  const dispatch = useDispatch();
  const [stage, setStage] = useState<'upload' | 'ocr' | 'review'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [proofId, setProofId] = useState<string | null>(null);

  // OCR Processing States
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState('');

  // Proof Fields State (Admin review & editable)
  const [approvedAmount, setApprovedAmount] = useState('');
  const [approvedCurrency, setApprovedCurrency] = useState('');
  const [approvedReference, setApprovedReference] = useState('');
  const [approvedBank, setApprovedBank] = useState('');
  const [approvedSender, setApprovedSender] = useState('');
  const [approvedReceiver, setApprovedReceiver] = useState('');
  const [approvedAccount, setApprovedAccount] = useState('');
  const [approvedWallet, setApprovedWallet] = useState('');
  const [approvedDate, setApprovedDate] = useState('');
  const [approvedTime, setApprovedTime] = useState('');
  const [approvedStatus, setApprovedStatus] = useState('SUCCESS');

  // OCR raw values and confidence rating storage
  const [ocrData, setOcrData] = useState<any>(null);
  const [showRawOcr, setShowRawOcr] = useState(false);

  // Image manipulation states
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageUrl, setImageUrl] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [approving, setApproving] = useState(false);
  const [loadingProof, setLoadingProof] = useState(false);

  useEffect(() => {
    if (isOpen && paymentRequestId) {
      setFile(null);
      setOcrProgress(0);
      setOcrStatusText('');
      setZoom(1);
      setRotation(0);

      const checkExistingProof = async () => {
        setLoadingProof(true);
        try {
          const res = await api.get(`/admin/payment-proof?paymentRequestId=${paymentRequestId}`);
          if (res.data.hasProof) {
            const p = res.data.proof;
            setProofId(p.id);
            setImageUrl(p.original_file_url);

            // Populate approved values from existing database record
            setApprovedAmount(p.approved_amount !== null && p.approved_amount !== undefined ? String(p.approved_amount) : '');
            setApprovedCurrency(p.approved_currency || '');
            setApprovedReference(p.approved_reference || '');
            setApprovedBank(p.approved_bank || '');
            setApprovedSender(p.approved_sender || '');
            setApprovedReceiver(p.approved_receiver || '');
            setApprovedAccount(p.approved_account || '');
            setApprovedWallet(p.approved_wallet || '');
            setApprovedDate(p.approved_date || '');
            setApprovedTime(p.approved_time || '');
            setApprovedStatus(p.approved_status || 'SUCCESS');

            setOcrData({
              ocr_raw_text: p.ocr_raw_text,
              ocr_confidence: p.ocr_confidence
            });

            setStage('review');
          } else {
            setStage('upload');
            setProofId(null);
            setImageUrl('');
          }
        } catch (err) {
          console.error('Failed to check existing proof:', err);
          setStage('upload');
          setProofId(null);
          setImageUrl('');
        } finally {
          setLoadingProof(false);
        }
      };

      checkExistingProof();
    }
  }, [isOpen, paymentRequestId]);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(selectedFile.type)) {
      dispatch(addToast({ message: 'Unsupported file type. Upload PNG, JPG, or JPEG.', type: 'error' }));
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxSize) {
      dispatch(addToast({ message: 'File size exceeds 10MB limit.', type: 'error' }));
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploadLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('paymentRequestId', paymentRequestId);

    try {
      const res = await api.post('/admin/payment-proof/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const uploadedProof = res.data.proof;
      setProofId(uploadedProof.id);
      setImageUrl(uploadedProof.originalFileUrl);
      setStage('ocr');
      runOcrSim(uploadedProof.id);
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to upload proof image.';
      dispatch(addToast({ message: msg, type: 'error' }));
    } finally {
      setUploadLoading(false);
    }
  };

  const runOcrSim = async (id: string) => {
    // Simulated progress bar updates while waiting for real API call
    const interval = setInterval(() => {
      setOcrProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        const step = Math.floor(Math.random() * 15) + 5;
        const next = prev + step;
        
        // Progress stage notifications
        if (next < 30) setOcrStatusText('Uploading and preparing image...');
        else if (next < 60) setOcrStatusText('Extracting payment metadata...');
        else if (next < 85) setOcrStatusText('Parsing receipt fields & calculating confidence...');
        else setOcrStatusText('Finalizing OCR output details...');
        
        return next;
      });
    }, 300);

    try {
      const res = await api.post(`/admin/payment-proof/${id}/ocr`);
      clearInterval(interval);
      setOcrProgress(100);
      setOcrStatusText('OCR processing completed successfully!');

      const proofData = res.data.proof;
      setOcrData(proofData);

      // Pre-fill editable form with OCR extracted values
      setApprovedAmount(proofData.ocr_amount || '');
      setApprovedCurrency(proofData.ocr_currency || '');
      setApprovedReference(proofData.ocr_reference || '');
      setApprovedBank(proofData.ocr_bank || '');
      setApprovedSender(proofData.ocr_sender || '');
      setApprovedReceiver(proofData.ocr_receiver || '');
      setApprovedAccount(proofData.ocr_account || '');
      setApprovedWallet(proofData.ocr_wallet || '');
      setApprovedDate(proofData.ocr_date || '');
      setApprovedTime(proofData.ocr_time || '');
      setApprovedStatus(proofData.ocr_status || 'SUCCESS');

      setTimeout(() => {
        setStage('review');
      }, 800);
    } catch (err: any) {
      clearInterval(interval);
      console.error(err);
      dispatch(addToast({ message: 'OCR analysis failed. Continuing to manual review.', type: 'info' }));
      
      // If OCR fails, we directly switch to review but with blank inputs so admin can type manually
      setStage('review');
    }
  };

  const handleSaveDraft = async () => {
    if (!proofId) return;
    setSavingDraft(true);
    try {
      await api.put(`/admin/payment-proof/${proofId}`, {
        approvedAmount,
        approvedCurrency,
        approvedReference,
        approvedBank,
        approvedSender,
        approvedReceiver,
        approvedAccount,
        approvedWallet,
        approvedDate,
        approvedTime,
        approvedStatus
      });
      dispatch(addToast({ message: 'Draft payment proof saved.', type: 'success' }));
    } catch (err: any) {
      console.error(err);
      dispatch(addToast({ message: 'Failed to save draft.', type: 'error' }));
    } finally {
      setSavingDraft(false);
    }
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofId) return;
    
    if (!approvedAmount || !approvedReference || !approvedCurrency) {
      dispatch(addToast({ message: 'Amount, Currency and Reference/UTR fields are required.', type: 'error' }));
      return;
    }

    setApproving(true);
    try {
      await api.post(`/admin/payment-proof/${proofId}/approve`, {
        approvedAmount,
        approvedCurrency,
        approvedReference,
        approvedBank,
        approvedSender,
        approvedReceiver,
        approvedAccount,
        approvedWallet,
        approvedDate,
        approvedTime,
        approvedStatus
      });
      
      dispatch(addToast({ message: 'Payment proof approved and request finalized!', type: 'success' }));
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to complete approval.';
      dispatch(addToast({ message: msg, type: 'error' }));
    } finally {
      setApproving(false);
    }
  };

  // Helper to check confidence and determine borders/styles
  const getFieldClass = (fieldName: string) => {
    // If it's a bank transfer, ignore wallet confidence
    if (currency === 'INR' && fieldName === 'wallet') {
      return 'border-gray-800 bg-gray-950 focus:ring-indigo-500/30';
    }
    // If it's crypto, ignore bank-related confidences
    if (currency !== 'INR' && ['bank', 'account', 'sender', 'receiver'].includes(fieldName)) {
      return 'border-gray-800 bg-gray-950 focus:ring-indigo-500/30';
    }

    const conf = ocrData?.ocr_confidence?.[fieldName];
    if (conf !== undefined && conf < 0.8) {
      return 'border-amber-500/80 bg-amber-500/5 focus:ring-amber-500/30';
    }
    return 'border-gray-800 bg-gray-950 focus:ring-indigo-500/30';
  };

  const renderConfidenceBadge = (fieldName: string) => {
    // If it's a bank transfer, ignore wallet confidence
    if (currency === 'INR' && fieldName === 'wallet') return null;
    // If it's crypto, ignore bank-related confidences
    if (currency !== 'INR' && ['bank', 'account', 'sender', 'receiver'].includes(fieldName)) return null;

    const conf = ocrData?.ocr_confidence?.[fieldName];
    if (conf === undefined) return null;
    const isLow = conf < 0.8;
    return (
      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ml-2 shrink-0 ${
        isLow ? 'bg-amber-500/20 text-amber-400 font-semibold flex items-center gap-0.5' : 'bg-gray-850 text-gray-500'
      }`}>
        {isLow && <AlertCircle className="w-2.5 h-2.5" />}
        {Math.round(conf * 100)}%
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-md font-sans">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white">Upload Payment Proof & Verify</h3>
            <p className="text-xs text-gray-400 mt-0.5">Assisted by secure OCR scanner</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-800 text-gray-400 hover:text-white rounded-xl transition-all cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Stages */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {loadingProof ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
              <span className="text-sm text-gray-400 font-medium">Checking transaction details...</span>
            </div>
          ) : (
            <>
              {/* Stage 1: Upload */}
          {stage === 'upload' && (
            <div className="max-w-xl mx-auto space-y-6 py-6">
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-3 transition-all ${
                  dragActive ? 'border-indigo-500 bg-indigo-500/5' : 'border-gray-800 hover:border-gray-700 bg-gray-950/50'
                }`}
              >
                <div className="p-4 bg-gray-900 rounded-2xl border border-gray-800 shadow-md">
                  <UploadCloud className="w-8 h-8 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-200">
                    Drag and drop receipt image, or{' '}
                    <label className="text-indigo-400 hover:underline cursor-pointer">
                      browse
                      <input type="file" className="hidden" accept=".png,.jpg,.jpeg" onChange={handleFileChange} />
                    </label>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Accepts PNG, JPG, or JPEG up to 10MB</p>
                </div>
              </div>

              {file && (
                <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 flex items-center justify-between shadow-inner">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600/10 text-indigo-400 rounded-lg">
                      <FileImage className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-white max-w-[250px] truncate">{file.name}</p>
                      <p className="text-[10px] text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    onClick={handleUpload}
                    disabled={uploadLoading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/15"
                  >
                    {uploadLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Proceed to OCR Scan
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Stage 2: OCR Loader */}
          {stage === 'ocr' && (
            <div className="max-w-md mx-auto py-12 flex flex-col items-center justify-center text-center gap-6">
              <div className="relative flex items-center justify-center w-20 h-20">
                <div className="absolute inset-0 border-4 border-indigo-500/10 rounded-full" />
                <div className="absolute inset-0 border-4 border-t-indigo-500 rounded-full animate-spin" />
                <FileImage className="w-8 h-8 text-indigo-400" />
              </div>
              <div className="space-y-2 w-full">
                <h4 className="text-sm font-semibold text-white">Running Automatic OCR...</h4>
                <p className="text-xs text-gray-500 font-medium">{ocrStatusText}</p>
                <div className="w-full bg-gray-950 border border-gray-850 h-2 rounded-full overflow-hidden mt-4">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all duration-300 shadow-lg shadow-indigo-500/30"
                    style={{ width: `${ocrProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Stage 3: Split-Screen Review & Form */}
          {stage === 'review' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch h-full">
              
              {/* Left Column: Receipt image preview */}
              <div className="lg:col-span-6 bg-gray-950 border border-gray-850 rounded-2xl flex flex-col overflow-hidden h-[50vh] lg:h-auto min-h-[350px]">
                
                {/* Control bar */}
                <div className="flex items-center justify-between p-3 border-b border-gray-850 bg-gray-900/60 shrink-0">
                  <span className="text-xs font-semibold text-gray-400">Payment Slip Proof</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setZoom(z => Math.min(z + 0.25, 2.5))}
                      className="p-1 bg-gray-950 hover:bg-gray-850 text-gray-300 rounded border border-gray-800 transition-colors cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
                      className="p-1 bg-gray-950 hover:bg-gray-850 text-gray-300 rounded border border-gray-800 transition-colors cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setRotation(r => (r + 90) % 360)}
                      className="p-1 bg-gray-950 hover:bg-gray-850 text-gray-300 rounded border border-gray-800 transition-colors cursor-pointer"
                      title="Rotate 90°"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                    <a
                      href={`/api/admin/payment-proof/${proofId}/download`}
                      download
                      className="p-1 bg-gray-950 hover:bg-gray-850 text-gray-300 rounded border border-gray-800 transition-colors flex items-center justify-center"
                      title="Download Proof File"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Image panel */}
                <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-0 bg-[radial-gradient(#1e1b4b1a_1px,transparent_1px)] bg-[size:16px_16px]">
                  <div className="relative max-h-full max-w-full overflow-hidden flex items-center justify-center">
                    <img
                      src={imageUrl}
                      alt="Payment Slip Proof"
                      className="max-h-[50vh] max-w-full object-contain rounded-lg border border-gray-800 shadow-lg select-none transition-all duration-300"
                      style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Editable data review form */}
              <div className="lg:col-span-6 flex flex-col border border-gray-850 bg-gray-950/20 rounded-2xl overflow-hidden p-5 space-y-4">
                <div className="border-b border-gray-850 pb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Extracted Ledger Data</span>
                  {ocrData?.ocr_confidence && (
                    <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-semibold px-2 py-0.5 rounded-full border border-indigo-500/20">
                      OCR confidence verified
                    </span>
                  )}
                </div>

                <form onSubmit={handleApprove} className="space-y-4 text-left">
                  
                  {/* Row 1: Amount & Currency */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center text-xs font-semibold text-gray-400 mb-1">
                        Approved Amount <span className="text-red-500 ml-0.5">*</span>
                        {renderConfidenceBadge('amount')}
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={approvedAmount}
                        onChange={(e) => setApprovedAmount(e.target.value)}
                        className={`w-full text-sm rounded-xl px-3 py-2 text-white border focus:outline-none focus:ring-2 transition-all font-mono font-bold ${getFieldClass('amount')}`}
                        required
                      />
                    </div>
                    <div>
                      <label className="flex items-center text-xs font-semibold text-gray-400 mb-1">
                        Currency <span className="text-red-500 ml-0.5">*</span>
                        {renderConfidenceBadge('currency')}
                      </label>
                      <input
                        type="text"
                        value={approvedCurrency}
                        onChange={(e) => setApprovedCurrency(e.target.value)}
                        className={`w-full text-sm rounded-xl px-3 py-2 text-white border focus:outline-none focus:ring-2 transition-all ${getFieldClass('currency')}`}
                        placeholder="INR / USDT / USD"
                        required
                      />
                    </div>
                  </div>

                  {/* Row 2: Reference/UTR */}
                  <div>
                    <label className="flex items-center text-xs font-semibold text-gray-400 mb-1">
                      {currency === 'INR' ? 'UTR / Ref No' : 'Transaction Hash'} <span className="text-red-500 ml-0.5">*</span>
                      {renderConfidenceBadge('reference')}
                    </label>
                    <input
                      type="text"
                      value={approvedReference}
                      onChange={(e) => setApprovedReference(e.target.value)}
                      className={`w-full text-sm rounded-xl px-3 py-2 text-white border focus:outline-none focus:ring-2 transition-all font-mono ${getFieldClass('reference')}`}
                      required
                    />
                  </div>

                  {currency === 'INR' ? (
                    <>
                      {/* Row 3: Bank & Account (Bank Transfer Only) */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="flex items-center text-xs font-semibold text-gray-400 mb-1">
                            Bank Name
                            {renderConfidenceBadge('bank')}
                          </label>
                          <input
                            type="text"
                            value={approvedBank}
                            onChange={(e) => setApprovedBank(e.target.value)}
                            className={`w-full text-sm rounded-xl px-3 py-2 text-white border focus:outline-none focus:ring-2 transition-all ${getFieldClass('bank')}`}
                            placeholder="e.g. HDFC Bank"
                          />
                        </div>
                        <div>
                          <label className="flex items-center text-xs font-semibold text-gray-400 mb-1">
                            Beneficiary Account Number
                            {renderConfidenceBadge('account')}
                          </label>
                          <input
                            type="text"
                            value={approvedAccount}
                            onChange={(e) => setApprovedAccount(e.target.value)}
                            className={`w-full text-sm rounded-xl px-3 py-2 text-white border focus:outline-none focus:ring-2 transition-all font-mono ${getFieldClass('account')}`}
                            placeholder="e.g. 1009410..."
                          />
                        </div>
                      </div>

                      {/* Row 4: Sender & Receiver (Bank Transfer Only) */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="flex items-center text-xs font-semibold text-gray-400 mb-1">
                            Sender Name
                            {renderConfidenceBadge('sender')}
                          </label>
                          <input
                            type="text"
                            value={approvedSender}
                            onChange={(e) => setApprovedSender(e.target.value)}
                            className={`w-full text-sm rounded-xl px-3 py-2 text-white border focus:outline-none focus:ring-2 transition-all ${getFieldClass('sender')}`}
                            placeholder="e.g. John Doe"
                          />
                        </div>
                        <div>
                          <label className="flex items-center text-xs font-semibold text-gray-400 mb-1">
                            Receiver Name
                            {renderConfidenceBadge('receiver')}
                          </label>
                          <input
                            type="text"
                            value={approvedReceiver}
                            onChange={(e) => setApprovedReceiver(e.target.value)}
                            className={`w-full text-sm rounded-xl px-3 py-2 text-white border focus:outline-none focus:ring-2 transition-all ${getFieldClass('receiver')}`}
                            placeholder="e.g. Merchant"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Row 3: Wallet Address (Crypto Only) */}
                      <div>
                        <label className="flex items-center text-xs font-semibold text-gray-400 mb-1">
                          Destination Wallet Address
                          {renderConfidenceBadge('wallet')}
                        </label>
                        <input
                          type="text"
                          value={approvedWallet}
                          onChange={(e) => setApprovedWallet(e.target.value)}
                          className={`w-full text-sm rounded-xl px-3 py-2 text-white border focus:outline-none focus:ring-2 transition-all font-mono ${getFieldClass('wallet')}`}
                          placeholder="e.g. T..."
                        />
                      </div>
                    </>
                  )}

                  {/* Row 5: Status */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center text-xs font-semibold text-gray-400 mb-1">
                        Status
                        {renderConfidenceBadge('status')}
                      </label>
                      <input
                        type="text"
                        value={approvedStatus}
                        onChange={(e) => setApprovedStatus(e.target.value)}
                        className={`w-full text-sm rounded-xl px-3 py-2 text-white border focus:outline-none focus:ring-2 transition-all ${getFieldClass('status')}`}
                      />
                    </div>
                    <div>
                      <label className="flex items-center text-xs font-semibold text-gray-400 mb-1">
                        Transaction Date
                        {renderConfidenceBadge('date')}
                      </label>
                      <input
                        type="text"
                        value={approvedDate}
                        onChange={(e) => setApprovedDate(e.target.value)}
                        className={`w-full text-sm rounded-xl px-3 py-2 text-white border focus:outline-none focus:ring-2 transition-all font-mono ${getFieldClass('date')}`}
                        placeholder="YYYY-MM-DD"
                      />
                    </div>
                  </div>

                  {/* Row 6: Time */}
                  <div>
                    <label className="flex items-center text-xs font-semibold text-gray-400 mb-1">
                      Transaction Time
                      {renderConfidenceBadge('time')}
                    </label>
                    <input
                      type="text"
                      value={approvedTime}
                      onChange={(e) => setApprovedTime(e.target.value)}
                      className={`w-full text-sm rounded-xl px-3 py-2 text-white border focus:outline-none focus:ring-2 transition-all font-mono ${getFieldClass('time')}`}
                      placeholder="HH:MM:SS"
                    />
                  </div>

                  {/* Raw OCR Block (Collapsible) */}
                  {ocrData?.ocr_raw_text && (
                    <div className="border border-gray-800 rounded-2xl overflow-hidden mt-2 bg-gray-950/40">
                      <button
                        type="button"
                        onClick={() => setShowRawOcr(!showRawOcr)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-900 text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <span>View Raw OCR Text Block</span>
                        {showRawOcr ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      {showRawOcr && (
                        <div className="p-3 border-t border-gray-800">
                          <pre className="text-[10px] text-gray-500 font-mono text-left whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed select-text bg-gray-950 p-2.5 rounded-xl border border-gray-900">
                            {ocrData.ocr_raw_text}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-850 shrink-0">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveDraft}
                        disabled={savingDraft}
                        className="px-4 py-2 bg-gray-950 border border-gray-800 hover:border-gray-750 text-indigo-400 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {savingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save Draft
                      </button>
                      <button
                        type="submit"
                        disabled={approving}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md shadow-emerald-600/10"
                      >
                        {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Approve & Publish
                      </button>
                    </div>
                  </div>

                </form>
              </div>
            </div>
          )}
        </>
      )}

        </div>

      </div>
    </div>
  );
}
