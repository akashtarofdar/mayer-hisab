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
  ChevronRight,
  ChevronLeft,
  Banknote
} from 'lucide-react';

// --- Firebase Configuration from Environment ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "AIzaSyAOE0GiypZD2KAD6UJZRzSzYGvdnEuEoTA",
      authDomain: "mayerhisab.firebaseapp.com",
      projectId: "mayerhisab",
      storageBucket: "mayerhisab.firebasestorage.app",
      messagingSenderId: "345872096043",
      appId: "1:345872096043:web:0bc930c643cfc77fd1036e"
    };

const appId = typeof __app_id !== 'undefined' ? __app_id : 'mayer-hisab-personal';

// Initialize Firebase services outside component
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
const StatusMessage = ({ message, type = 'loading' }) => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center font-sans">
    {type === 'error' ? (
      <div className="bg-red-100 p-4 rounded-full mb-4 animate-bounce">
        <WifiOff className="w-12 h-12 text-red-600" />
      </div>
    ) : (
      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-emerald-600 mb-4"></div>
    )}
    <h1 className={`text-2xl font-bold mb-2 ${type === 'error' ? 'text-red-700' : 'text-gray-800'}`}>
      {type === 'error' ? 'সমস্যা হচ্ছে!' : 'হিসাব লোড হচ্ছে...'}
    </h1>
    <p className="text-gray-600 max-w-md mb-6 font-medium">{message}</p>
    {type === 'error' && (
      <button 
        onClick={() => window.location.reload()}
        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-full font-bold transition-colors flex items-center gap-2 mx-auto"
      >
        <RefreshCcw size={18} /> রিলোড করুন
      </button>
    )}
  </div>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  
  // App States
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null); 
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  
  // Form States
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substr(0, 10));
  const [isSaving, setIsSaving] = useState(false);

  // 1. Auth Setup (Rule 3)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error:", err);
        setErrorMsg("অথেন্টিকেশন ব্যর্থ হয়েছে। দয়া করে রিলোড করুন।");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Data (Depends on User)
  useEffect(() => {
    if (!user || !db) return;
    
    setLoading(true);
    // Path correctly follows Rule 1
    const collectionPath = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
    const q = query(collectionPath);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Memory side sorting (Rule 2)
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
      console.error("Firestore Snapshot Error:", err);
      setErrorMsg("ডাটাবেস কানেকশন সমস্যা। পারমিশন চেক করুন।");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // --- Calculations ---
  const globalStats = useMemo(() => {
    let hand = 0;
    let bank = 0;
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
      const tMonth = tDate.toISOString().slice(0, 7);
      return tMonth === selectedMonth;
    });
  }, [transactions, selectedMonth]);

  const monthlyStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    monthlyTransactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'remittance') income += amt;
      if (t.type === 'expense') expense += amt;
    });
    return { income, expense };
  }, [monthlyTransactions]);

  // --- Handlers ---
  const handleEdit = (t) => {
    setEditingId(t.id);
    setType(t.type);
    setAmount(t.amount);
    setNote(t.description || '');
    const d = t.date.toDate ? t.date.toDate() : new Date(t.date);
    setDate(d.toISOString().split('T')[0]);
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setAmount('');
    setNote('');
    setType('expense');
    setDate(new Date().toISOString().substr(0, 10));
    setShowModal(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!amount || !user) return;

    setIsSaving(true);
    try {
      const payload = {
        type,
        amount: parseFloat(amount),
        description: note,
        date: Timestamp.fromDate(new Date(date)),
        updatedAt: Timestamp.now()
      };

      if (!editingId) {
        payload.createdAt = Timestamp.now();
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), payload);
      } else {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', editingId), payload);
      }
      resetForm();
    } catch (error) {
      console.error("Save error:", error);
      alert("তথ্য সংরক্ষণ করা সম্ভব হয়নি। নেটওয়ার্ক চেক করুন।");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!user) return;
    const isConfirmed = window.confirm("আপনি কি নিশ্চিত এই হিসাবটি মুছে ফেলতে চান?");
    if (isConfirmed) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id));
      } catch (err) {
        console.error("Delete error:", err);
      }
    }
  };

  if (errorMsg) return <StatusMessage type="error" message={errorMsg} />;
  if (loading && !user) return <StatusMessage type="loading" message="সিস্টেম চালু হচ্ছে..." />;

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-24 print:bg-white print:pb-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white; font-size: 12pt; }
        }
      `}</style>

      {/* Header Section */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-40 no-print">
        <div className="max-w-xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-2 rounded-lg text-white">
              <Banknote size={20} />
            </div>
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">মায়ের হিসাব</h1>
          </div>
          <button 
            onClick={() => window.print()}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Printer size={20} />
          </button>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        
        {/* Global Summary Cards */}
        <div className="grid grid-cols-2 gap-4 no-print">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 rounded-2xl text-white shadow-md shadow-emerald-100">
            <div className="flex items-center gap-2 opacity-80 mb-1">
              <Wallet size={16}/>
              <span className="text-xs font-medium">হাতে নগদ</span>
            </div>
            <p className="text-2xl font-bold">{formatTaka(globalStats.hand)}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-5 rounded-2xl text-white shadow-md shadow-blue-100">
            <div className="flex items-center gap-2 opacity-80 mb-1">
              <Landmark size={16}/>
              <span className="text-xs font-medium">ব্যাংকে জমা</span>
            </div>
            <p className="text-2xl font-bold">{formatTaka(globalStats.bank)}</p>
          </div>
        </div>

        {/* Month Navigation & Stats */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 print:border print:border-gray-200">
          <div className="flex justify-between items-center mb-6 no-print">
            <h2 className="font-bold text-gray-700 flex items-center gap-2">
              <Filter size={18} className="text-gray-400" />
              মাসিক সামারি
            </h2>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-sm font-semibold rounded-lg p-2 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="print-only hidden text-center mb-4">
             <h1 className="text-2xl font-bold">মায়ের হিসাব রিপোর্ট</h1>
             <p className="text-gray-600">{new Date(selectedMonth).toLocaleDateString('bn-BD', { month: 'long', year: 'numeric' })}</p>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t pt-4">
            <div className="text-center">
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">মোট আয়</p>
              <p className="text-lg font-bold text-emerald-600">{formatTaka(monthlyStats.income)}</p>
            </div>
            <div className="text-center border-x border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">মোট খরচ</p>
              <p className="text-lg font-bold text-rose-600">{formatTaka(monthlyStats.expense)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">অবশিষ্ট</p>
              <p className="text-lg font-bold text-gray-800">{formatTaka(monthlyStats.income - monthlyStats.expense)}</p>
            </div>
          </div>
        </div>

        {/* Transactions List */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-sm font-bold text-gray-500">লেনদেনের ইতিহাস</h3>
            <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-bold">
              {monthlyTransactions.length} টি এন্ট্রি
            </span>
          </div>

          {monthlyTransactions.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-gray-100">
              <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400 font-medium">এই মাসে কোনো হিসাব নেই</p>
            </div>
          ) : (
            <div className="space-y-3">
              {monthlyTransactions.map((t) => (
                <div 
                  key={t.id} 
                  className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50 flex items-center justify-between group hover:border-emerald-200 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${
                      t.type === 'remittance' ? 'bg-emerald-50 text-emerald-600' : 
                      t.type === 'expense' ? 'bg-rose-50 text-rose-600' : 
                      t.type === 'deposit' ? 'bg-blue-50 text-blue-600' : 
                      t.type === 'withdraw' ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-600'
                    }`}>
                      {t.type === 'remittance' && <ArrowDownCircle size={24} />}
                      {t.type === 'expense' && <ArrowUpCircle size={24} />}
                      {t.type === 'deposit' && <ArrowRight size={24} />}
                      {t.type === 'withdraw' && <ArrowRight size={24} className="rotate-180" />}
                      {t.type === 'interest' && <Plus size={24} />}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm">
                        {t.type === 'remittance' && 'টাকা পাঠানো হয়েছে'}
                        {t.type === 'expense' && 'ব্যক্তিগত খরচ'}
                        {t.type === 'deposit' && 'ব্যাংকে জমা'}
                        {t.type === 'withdraw' && 'ব্যাংক থেকে উত্তোলন'}
                        {t.type === 'interest' && 'ব্যাংক মুনাফা'}
                      </h4>
                      <p className="text-[11px] text-gray-400 font-medium">{formatDate(t.date)}</p>
                      {t.description && (
                        <p className="text-[11px] text-gray-500 mt-1 italic leading-tight max-w-[150px] truncate sm:max-w-none">
                          "{t.description}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={`font-black text-base ${
                      ['remittance', 'withdraw', 'interest'].includes(t.type) ? 'text-emerald-600' : 
                      t.type === 'deposit' ? 'text-blue-600' : 'text-rose-600'
                    }`}>
                      {['expense', 'deposit'].includes(t.type) ? '-' : '+'} {formatTaka(t.amount)}
                    </p>
                    <div className="flex justify-end gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                      <button onClick={() => handleEdit(t)} className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      <button 
        onClick={resetForm}
        className="fixed bottom-8 right-8 bg-gray-900 text-white p-4 rounded-2xl shadow-xl shadow-gray-200 flex items-center gap-3 active:scale-95 transition-all hover:bg-black no-print z-50 ring-4 ring-white"
      >
        <Plus size={24} />
        <span className="font-bold text-sm pr-1">নতুন হিসাব</span>
      </button>

      {/* Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] no-print p-4">
          <div className="bg-white w-full max-w-md p-6 rounded-3xl animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">
                {editingId ? 'হিসাব সংশোধন' : 'নতুন হিসাব যুক্ত করুন'}
              </h2>
              <button 
                onClick={() => setShowModal(false)} 
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-colors"
              >✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[11px] font-bold text-gray-400 uppercase ml-1">লেনদেনের ধরণ</label>
                  <select 
                    value={type} 
                    onChange={(e) => setType(e.target.value)}
                    className="w-full mt-1 p-3.5 bg-gray-50 border-2 border-transparent rounded-2xl font-bold text-gray-800 outline-none focus:border-emerald-500 focus:bg-white transition-all appearance-none"
                  >
                    <option value="remittance">মা টাকা পাঠিয়েছে (+)</option>
                    <option value="expense">ব্যক্তিগত খরচ (-)</option>
                    <option value="deposit">ব্যাংকে জমা দিয়েছি (→)</option>
                    <option value="withdraw">ব্যাংক থেকে তুলেছি (←)</option>
                    <option value="interest">ব্যাংক মুনাফা (+)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase ml-1">তারিখ</label>
                  <input 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full mt-1 p-3.5 bg-gray-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase ml-1">পরিমাণ (৳)</label>
                  <input 
                    type="number" 
                    placeholder="0" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full mt-1 p-3.5 bg-gray-50 border-2 border-transparent rounded-2xl font-bold text-lg text-emerald-600 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase ml-1">নোট / বিবরণ</label>
                <input 
                  type="text" 
                  placeholder="যেমন: চাল কেনা, যাতায়াত খরচ ইত্যাদি"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full mt-1 p-3.5 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-emerald-500 focus:bg-white transition-all"
                />
              </div>

              <button 
                type="submit" 
                disabled={isSaving}
                className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl mt-6 shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:bg-emerald-700 disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <><Save size={20} /> {editingId ? 'আপডেট করুন' : 'নিশ্চিত করুন'}</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}