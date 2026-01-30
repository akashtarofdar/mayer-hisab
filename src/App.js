/* global __firebase_config, __app_id, __initial_auth_token */
import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  deleteDoc, 
  updateDoc,
  doc, 
  Timestamp 
} from 'firebase/firestore';
import { 
  Plus, 
  Trash2, 
  Edit2,
  Wallet, 
  Landmark, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  ArrowRight,
  Printer,
  Filter,
  Calendar,
  Save,
  RefreshCcw,
  WifiOff,
  Banknote,
  Lock,
  Unlock,
  Eye,
  EyeOff
} from 'lucide-react';

// --- Configuration ---
const APP_PASSWORD = "627425274"; // আপনার গোপন পাসওয়ার্ড

// গ্লোবাল ভেরিয়েবলগুলো সুরক্ষিতভাবে চেক করা (Vercel Build fix)
const getGlobalConfig = () => {
  try {
    if (typeof window !== 'undefined' && window.__firebase_config) {
      return JSON.parse(window.__firebase_config);
    }
    if (typeof __firebase_config !== 'undefined') {
      return JSON.parse(__firebase_config);
    }
  } catch (e) {
    console.error("Config parse error", e);
  }
  return {
    apiKey: "AIzaSyAOE0GiypZD2KAD6UJZRzSzYGvdnEuEoTA",
    authDomain: "mayerhisab.firebaseapp.com",
    projectId: "mayerhisab",
    storageBucket: "mayerhisab.firebasestorage.app",
    messagingSenderId: "345872096043",
    appId: "1:345872096043:web:0bc930c643cfc77fd1036e"
  };
};

const firebaseConfig = getGlobalConfig();
const appId = (typeof window !== 'undefined' && window.__app_id) || 
              (typeof __app_id !== 'undefined' ? __app_id : 'mayer-hisab-personal');

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Utility Functions ---
const formatTaka = (amount) => {
  return new Intl.NumberFormat('bn-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatDate = (dateObj) => {
  if (!dateObj) return '';
  const date = dateObj.toDate ? dateObj.toDate() : new Date(dateObj);
  return date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
};

// --- Components ---

const PasswordGate = ({ onAuthorized }) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input === APP_PASSWORD) {
      onAuthorized(true);
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
      <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in duration-300">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner">
          <Lock size={40} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-800">মায়ের হিসাব</h1>
          <p className="text-gray-500 font-medium mt-1">ব্যক্তিগত ব্যবহারের জন্য সুরক্ষিত</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input 
              type={showPass ? "text" : "password"}
              placeholder="পাসওয়ার্ড দিন"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className={`w-full p-4 bg-gray-50 border-2 rounded-2xl outline-none text-center font-bold text-xl tracking-widest transition-all ${error ? 'border-red-500 animate-shake' : 'border-gray-100 focus:border-emerald-500'}`}
              autoFocus
              autoComplete="off"
            />
            <button 
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 p-1"
            >
              {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          
          <button 
            type="submit"
            className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Unlock size={20} /> প্রবেশ করুন
          </button>
        </form>

        {error && <p className="text-red-500 text-sm font-bold animate-pulse">ভুল পাসওয়ার্ড!</p>}
      </div>
    </div>
  );
};

const StatusMessage = ({ message, type = 'loading' }) => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center font-sans">
    {type === 'error' ? (
      <div className="bg-red-100 p-4 rounded-full mb-4 animate-bounce text-red-600"><WifiOff size={48} /></div>
    ) : (
      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-emerald-600 mb-4"></div>
    )}
    <h1 className="text-2xl font-bold mb-2 text-gray-800">{type === 'error' ? 'কানেকশন এরর' : 'হিসাব লোড হচ্ছে...'}</h1>
    <p className="text-gray-600 font-medium">{message}</p>
  </div>
);

export default function App() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null); 
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substr(0, 10));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isAuthorized) return;
    const initAuth = async () => {
      try {
        const token = (typeof window !== 'undefined' && window.__initial_auth_token) || 
                      (typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null);

        if (token) {
          await signInWithCustomToken(auth, token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { 
        console.error("Auth Error:", err); 
        // Fallback to anonymous if custom token fails
        try { await signInAnonymously(auth); } catch(e) {}
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, [isAuthorized]);

  useEffect(() => {
    if (!user || !isAuthorized) return;
    
    setLoading(true);
    const collectionPath = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    const q = query(collectionPath);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      data.sort((a, b) => {
        const dateA = a.date?.seconds || 0;
        const dateB = b.date?.seconds || 0;
        if (dateB !== dateA) return dateB - dateA;
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });

      setTransactions(data);
      setLoading(false);
      setErrorMsg(null);
    }, (err) => {
      console.error(err);
      setErrorMsg("ডাটাবেস এক্সেস করতে সমস্যা হচ্ছে। ফায়ারবেস রুলস চেক করুন।");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, isAuthorized]);

  const globalStats = useMemo(() => {
    let hand = 0; let bank = 0;
    transactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'remittance') hand += amt;
      if (t.type === 'expense') hand -= amt;
      if (t.type === 'deposit') { hand -= amt; bank += amt; }
      if (t.type === 'withdraw') { bank -= amt; hand += amt; }
      if (t.type === 'interest') bank += amt;
    });
    return { hand, bank };
  }, [transactions]);

  const monthlyTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (!t.date) return false;
      const tDate = t.date.toDate ? t.date.toDate() : new Date(t.date);
      return tDate.toISOString().slice(0, 7) === selectedMonth;
    });
  }, [transactions, selectedMonth]);

  const monthlyStats = useMemo(() => {
    let income = 0; let expense = 0;
    monthlyTransactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'remittance') income += amt;
      if (t.type === 'expense') expense += amt;
    });
    return { income, expense };
  }, [monthlyTransactions]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!amount || !user) return;
    setIsSaving(true);
    try {
      const payload = {
        type, amount: parseFloat(amount), description: note,
        date: Timestamp.fromDate(new Date(date)), updatedAt: Timestamp.now()
      };
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
      if (!editingId) {
        payload.createdAt = Timestamp.now();
        await addDoc(colRef, payload);
      } else {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', editingId), payload);
      }
      setShowModal(false);
      setEditingId(null); setAmount(''); setNote('');
    } catch (error) {
      alert("সেভ করা যায়নি।");
    } finally { setIsSaving(false); }
  };

  if (!isAuthorized) return <PasswordGate onAuthorized={setIsAuthorized} />;
  if (errorMsg) return <StatusMessage type="error" message={errorMsg} />;
  if (loading && !user) return <StatusMessage type="loading" message="ডাটা কানেক্ট করা হচ্ছে..." />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24 print:bg-white print:pb-0">
      <style>{`
        @media print { .no-print { display: none !important; } .print-only { display: block !important; } body { background: white; } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .animate-shake { animation: shake 0.2s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40 no-print shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-2 rounded-xl text-white shadow-md shadow-emerald-200"><Banknote size={20} /></div>
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">মায়ের হিসাব</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"><Printer size={20} /></button>
            <button onClick={() => window.location.reload()} className="p-2 text-gray-400 hover:text-rose-500 rounded-full transition-colors"><Lock size={20} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {/* Balance Cards */}
        <div className="grid grid-cols-2 gap-4 no-print">
          <div className="bg-emerald-600 p-5 rounded-3xl text-white shadow-xl shadow-emerald-100 relative overflow-hidden">
            <Wallet size={64} className="absolute -right-4 -bottom-4 opacity-20 rotate-12" />
            <p className="text-xs font-bold opacity-80 uppercase tracking-widest">হাতে নগদ</p>
            <p className="text-2xl font-black mt-1">{formatTaka(globalStats.hand)}</p>
          </div>
          <div className="bg-blue-600 p-5 rounded-3xl text-white shadow-xl shadow-blue-100 relative overflow-hidden">
            <Landmark size={64} className="absolute -right-4 -bottom-4 opacity-20 -rotate-12" />
            <p className="text-xs font-bold opacity-80 uppercase tracking-widest">ব্যাংকে জমা</p>
            <p className="text-2xl font-black mt-1">{formatTaka(globalStats.bank)}</p>
          </div>
        </div>

        {/* Month Summary */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6 no-print">
            <h2 className="font-bold text-gray-700 flex items-center gap-2"><Filter size={18} className="text-emerald-500" /> মাসিক সামারি</h2>
            <input 
              type="month" value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-gray-50 border-none font-bold text-sm rounded-xl p-2 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="print-only hidden text-center mb-6 border-b pb-4">
             <h1 className="text-2xl font-bold">মায়ের হিসাব - মাসিক রিপোর্ট</h1>
             <p className="text-gray-500">{new Date(selectedMonth).toLocaleDateString('bn-BD', { month: 'long', year: 'numeric' })}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 py-2">
            <div className="text-center">
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">এই মাসে আয়</p>
              <p className="text-base font-black text-emerald-600">{formatTaka(monthlyStats.income)}</p>
            </div>
            <div className="text-center border-x border-gray-50">
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">এই মাসে খরচ</p>
              <p className="text-base font-black text-rose-600">{formatTaka(monthlyStats.expense)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">অবশিষ্ট</p>
              <p className="text-base font-black text-gray-800">{formatTaka(monthlyStats.income - monthlyStats.expense)}</p>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-400 px-1 uppercase tracking-wider flex justify-between">
            লেনদেনের ইতিহাস <span>{monthlyTransactions.length} টি</span>
          </h3>

          {monthlyTransactions.length === 0 ? (
            <div className="bg-white rounded-3xl p-16 text-center border-2 border-dashed border-gray-100">
              <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400 font-bold">কোন হিসাব পাওয়া যায়নি</p>
            </div>
          ) : (
            <div className="space-y-3">
              {monthlyTransactions.map((t) => (
                <div key={t.id} className="bg-white p-4 rounded-3xl shadow-sm border border-transparent hover:border-emerald-100 transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${
                      t.type === 'remittance' ? 'bg-emerald-50 text-emerald-600' : 
                      t.type === 'expense' ? 'bg-rose-50 text-rose-600' : 
                      t.type === 'deposit' ? 'bg-blue-50 text-blue-600' : 
                      t.type === 'withdraw' ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-400'
                    }`}>
                      {t.type === 'remittance' && <ArrowDownCircle size={22} />}
                      {t.type === 'expense' && <ArrowUpCircle size={22} />}
                      {t.type === 'deposit' && <ArrowRight size={22} />}
                      {t.type === 'withdraw' && <ArrowRight size={22} className="rotate-180" />}
                      {t.type === 'interest' && <Plus size={22} />}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm">
                        {t.type === 'remittance' ? 'টাকা আসলো' : t.type === 'expense' ? 'খরচ হয়েছে' : t.type === 'deposit' ? 'ব্যাংকে জমা' : t.type === 'withdraw' ? 'উত্তোলন' : 'ব্যাংক মুনাফা'}
                      </h4>
                      <p className="text-[11px] text-gray-400 font-bold">{formatDate(t.date)}</p>
                      {t.description && <p className="text-[11px] text-gray-500 mt-1 italic leading-tight">"{t.description}"</p>}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={`font-black text-base ${['remittance', 'withdraw', 'interest'].includes(t.type) ? 'text-emerald-600' : t.type === 'deposit' ? 'text-blue-600' : 'text-rose-600'}`}>
                      {['expense', 'deposit'].includes(t.type) ? '-' : '+'} {formatTaka(t.amount)}
                    </p>
                    <div className="flex justify-end gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                      <button onClick={() => { setEditingId(t.id); setType(t.type); setAmount(t.amount); setNote(t.description || ''); setDate((t.date.toDate ? t.date.toDate() : new Date(t.date)).toISOString().split('T')[0]); setShowModal(true); }} className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                      <button onClick={async () => { if(window.confirm("মুছে ফেলবেন?")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', t.id)); }} className="p-1.5 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* FAB */}
      <button 
        onClick={() => { setEditingId(null); setAmount(''); setNote(''); setType('expense'); setShowModal(true); }}
        className="fixed bottom-8 right-8 bg-gray-900 text-white p-4 rounded-3xl shadow-2xl flex items-center gap-3 active:scale-95 transition-all hover:bg-black no-print z-50 ring-4 ring-white"
      >
        <Plus size={24} /> <span className="font-bold text-sm pr-1">নতুন হিসাব</span>
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] no-print p-4">
          <div className="bg-white w-full max-w-md p-6 rounded-[2.5rem] animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">{editingId ? 'হিসাব পরিবর্তন' : 'নতুন হিসাব'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-2xl transition-colors">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[11px] font-bold text-gray-400 uppercase ml-2">ধরণ</label>
                  <select value={type} onChange={(e) => setType(e.target.value)} className="w-full mt-1 p-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500 transition-all appearance-none">
                    <option value="remittance">মা টাকা পাঠিয়েছে (+)</option>
                    <option value="expense">ব্যক্তিগত খরচ (-)</option>
                    <option value="deposit">ব্যাংকে জমা দিয়েছি (→)</option>
                    <option value="withdraw">ব্যাংক থেকে তুলেছি (←)</option>
                    <option value="interest">ব্যাংক মুনাফা (+)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase ml-2">তারিখ</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 p-4 bg-gray-50 border-none rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase ml-2">পরিমাণ</label>
                  <input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full mt-1 p-4 bg-gray-50 border-none rounded-2xl font-bold text-lg text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500 transition-all" required />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase ml-2">নোট / বিবরণ</label>
                <input type="text" placeholder="বিস্তারিত লিখুন..." value={note} onChange={(e) => setNote(e.target.value)} className="w-full mt-1 p-4 bg-gray-50 border-none rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all" />
              </div>

              <button type="submit" disabled={isSaving} className="w-full bg-emerald-600 text-white font-bold py-5 rounded-[2rem] mt-4 shadow-lg shadow-emerald-50 flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-emerald-700 disabled:opacity-50">
                {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Save size={20} /> সেভ করুন</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}