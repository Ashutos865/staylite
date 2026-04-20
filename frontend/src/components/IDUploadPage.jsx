import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Upload, CheckCircle2, AlertCircle, Camera, FileImage, Hotel } from 'lucide-react';

export default function IDUploadPage() {
  const { token } = useParams();
  const [state, setState] = useState('idle'); // idle | uploading | success | error | expired
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('');
  const fileRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    upload(file);
  };

  const upload = async (file) => {
    setState('uploading');
    try {
      const fd = new FormData();
      fd.append('idPhoto', file);

      const res = await fetch(`http://localhost:5000/api/public/upload-id/${token}`, {
        method: 'POST',
        body: fd
      });
      const data = await res.json();

      if (res.ok) {
        setState('success');
        setMessage('Your ID has been uploaded. You can close this tab.');
      } else if (res.status === 404) {
        setState('expired');
        setMessage(data.message || 'QR code expired. Ask staff for a new one.');
      } else if (res.status === 400 && data.message?.includes('already uploaded')) {
        setState('success');
        setMessage('ID already received. All good!');
      } else {
        setState('error');
        setMessage(data.message || 'Upload failed. Please try again.');
      }
    } catch {
      setState('error');
      setMessage('Network error. Please check your connection and try again.');
    }
  };

  const retry = () => {
    setState('idle');
    setPreview(null);
    setMessage('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg overflow-hidden">

        {/* Header */}
        <div className="bg-blue-600 px-6 py-5 text-white text-center">
          <div className="flex justify-center mb-2">
            <Hotel className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold">ID Proof Upload</h1>
          <p className="text-blue-200 text-xs mt-1">Secure upload for hotel check-in</p>
        </div>

        <div className="p-6">

          {/* IDLE — choose file */}
          {state === 'idle' && (
            <>
              <p className="text-sm text-gray-600 text-center mb-6">
                Take a photo of your government-issued ID or upload from gallery.
              </p>

              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />

              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-3 py-8 border-2 border-dashed border-blue-300 rounded-xl bg-blue-50 hover:bg-blue-100 active:bg-blue-200 transition-colors"
              >
                <Camera className="w-10 h-10 text-blue-500" />
                <span className="text-sm font-semibold text-blue-700">Take Photo / Choose File</span>
                <span className="text-xs text-blue-400">JPEG, PNG, WebP or PDF · max 10 MB</span>
              </button>

              <p className="text-[10px] text-gray-400 text-center mt-4">
                Your document is stored securely and only visible to hotel staff.
              </p>
            </>
          )}

          {/* UPLOADING */}
          {state === 'uploading' && (
            <div className="flex flex-col items-center py-8 gap-4">
              {preview && (
                <img
                  src={preview}
                  alt="ID preview"
                  className="w-32 h-32 object-cover rounded-xl border border-gray-200 shadow-sm"
                />
              )}
              <div className="flex items-center gap-2 text-blue-600">
                <Upload className="w-5 h-5 animate-bounce" />
                <span className="text-sm font-semibold">Uploading securely...</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full animate-pulse w-3/4" />
              </div>
            </div>
          )}

          {/* SUCCESS */}
          {state === 'success' && (
            <div className="flex flex-col items-center py-8 gap-4 text-center">
              {preview && (
                <img
                  src={preview}
                  alt="ID preview"
                  className="w-32 h-32 object-cover rounded-xl border-2 border-green-200 shadow-sm"
                />
              )}
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <div>
                <h2 className="text-base font-bold text-gray-900">Upload Complete!</h2>
                <p className="text-sm text-gray-500 mt-1">{message}</p>
              </div>
            </div>
          )}

          {/* EXPIRED */}
          {state === 'expired' && (
            <div className="flex flex-col items-center py-8 gap-4 text-center">
              <AlertCircle className="w-12 h-12 text-orange-400" />
              <div>
                <h2 className="text-base font-bold text-gray-900">QR Code Expired</h2>
                <p className="text-sm text-gray-500 mt-1">{message}</p>
              </div>
            </div>
          )}

          {/* ERROR */}
          {state === 'error' && (
            <div className="flex flex-col items-center py-8 gap-4 text-center">
              {preview && (
                <img
                  src={preview}
                  alt="preview"
                  className="w-32 h-32 object-cover rounded-xl border border-red-200"
                />
              )}
              <AlertCircle className="w-12 h-12 text-red-400" />
              <div>
                <h2 className="text-base font-bold text-gray-900">Upload Failed</h2>
                <p className="text-sm text-gray-500 mt-1">{message}</p>
              </div>
              <button
                onClick={retry}
                className="mt-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition"
              >
                Try Again
              </button>
            </div>
          )}

        </div>
      </div>

      <p className="text-xs text-gray-400 mt-6 text-center">
        Powered by StayLite · Secure document handling
      </p>
    </div>
  );
}
