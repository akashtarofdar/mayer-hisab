import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously,
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
  AlertTriangle,
  Save,
  ShieldCheck,
  RefreshCcw,
  WifiOff
} from 'lucide-react';

// --- ফায়ারবেস কনফিগারেশন ---
// আপনার দেওয়া কনফিগারেশনটি এখানে বসানো হলো
const firebaseConfig = {
  apiKey: "AIzaSyAOE0GiypZD2KAD6UJZRzSzYGvdnEuEoTA",
  authDomain: "mayerhisab.firebaseapp.com",
  projectId: "mayerhisab",
  storageBucket: "mayerhisab.firebasestorage.app",
  messagingSenderId: "345872096043",
  appId: "1:345872096043:web:0bc930c643cfc77fd1036e",
  measurementId: "G-RJ5CQCRQTQ"
};

const appId = "mayer-hisab-personal"; 

// ফিক্সড ইউজার আইডি (যাতে সব ডিভাইসে একই ডাটা দেখায়)
const FIXED_USER_ID = "my_personal_account"; 

// অ্যাপ ইনিশিয়লাইজেশন
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase init error:", error);
}

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

// লোডিং বা এরর মেসেজ কম্পোনেন্ট
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
    
    <p className="text-gray-600 max-w-md mb-6 font-medium">
      {message}
    </p>
    
    {type === 'error' && (
        <div className="mt-4">
            <button 
                onClick={() => window.location.reload()}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-full font-bold transition-colors flex items-center gap-2 mx-auto"
            >
                <RefreshCcw size={18} /> রিলোড করুন
            </button>
        </div>
    )}
  </div>
);

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  
  // States
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null); 
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  // Form Inputs
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substr(0, 10));
  const [isSaving, setIsSaving] = useState(false);

  // ১. কানেকশন সেটআপ (লগইন চেষ্টা করবে, কিন্তু ফেইল করলেও সমস্যা নেই)
  useEffect(() => {
    const tryLogin = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.warn("Auth failed (OK if rules are public):", err);
      }
    };
    tryLogin();
  }, []);

  // ২. ডাটা আনা (লগইন ছাড়াই কাজ করবে)
  useEffect(() => {
    if (!db) return;
    
    try {
        const q = query(collection(db, 'artifacts', appId, 'users', FIXED_USER_ID, 'transactions'));
        
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
        }, (err) => {
            console.error("Data Fetch Error:", err);
            
            // এরর মেসেজ হ্যান্ডলিং
            if (err.code === 'permission-denied') {
                setErrorMsg("ডাটাবেস পারমিশন নেই। আপনি কি নিশ্চিত যে Rules এ 'true' সেট করেছেন?");
            } else {
                setErrorMsg("নেটওয়ার্ক সমস্যা অথবা ডাটাবেস লোড করা যাচ্ছে না।");
            }
            setLoading(false);
        });

        return () => unsubscribe();
    } catch (err) {
        console.error("Firestore Error:", err);
        setErrorMsg("সিস্টেম এরর: " + err.message);
        setLoading(false);
    }
  }, []);

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
      const tDate = t.date.toDate();
      const tMonth = tDate.toISOString().slice(0, 7);
      return tMonth === selectedMonth;
    });
  }, [transactions, selectedMonth]);

  const monthlyStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    let bankDeposit = 0;
    
    monthlyTransactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'remittance') income += amt;
      if (t.type === 'expense') expense += amt;
      if (t.type === 'deposit') bankDeposit += amt;
    });
    
    return { income, expense, bankDeposit };
  }, [monthlyTransactions]);

  // --- Handlers ---
  const handleEdit = (t) => {
    setEditingId(t.id);
    setType(t.type);
    setAmount(t.amount);
    setNote(t.description || '');
    const d = t.date.toDate();
    const dateStr = d.toISOString().split('T')[0];
    setDate(dateStr);
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
    if (!amount) return;

    setIsSaving(true);
    try {
      const data = {
        type,
        amount: parseFloat(amount),
        description: note,
        date: Timestamp.fromDate(new Date(date)),
        ...(editingId ? { updatedAt: Timestamp.now() } : { createdAt: Timestamp.now() })
      };

      if (editingId) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', FIXED_USER_ID, 'transactions', editingId), data);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', FIXED_USER_ID, 'transactions'), data);
      }
      resetForm();
    } catch (error) {
      alert("সেভ করা যায়নি। পারমিশন সমস্যা হতে পারে।");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if(confirm("আপনি কি নিশ্চিত এই হিসাবটি মুছে ফেলতে চান?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', FIXED_USER_ID, 'transactions', id));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (errorMsg) return <StatusMessage type="error" message={errorMsg} />;
  if (loading) return <StatusMessage type="loading" message="হিসাব লোড হচ্ছে..." />;

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-24 print:bg-white print:pb-0">
      
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white; font-size: 12pt; }
          .card { border: 1px solid #ddd; box-shadow: none; }
        }
      `}</style>

      {/* Header */}
      <div className="bg-white p-6 shadow-sm sticky top-0 z-10 print:static print:shadow-none print:p-0 print:mb-4">
        <div className="flex justify-between items-center mb-6 print:hidden">
          <h1 className="text-xl font-bold text-gray-800">মায়ের হিসাব</h1>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 text-sm bg-gray-100 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-200"
          >
            <Printer size={16} /> প্রিন্ট
          </button>
        </div>

        <div className="hidden print:block text-center mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold">মায়ের হিসাব - মাসিক রিপোর্ট</h1>
          <p className="text-gray-500">মাস: {new Date(selectedMonth).toLocaleDateString('bn-BD', { month: 'long', year: 'numeric' })}</p>
        </div>
        
        {/* Global Cards */}
        <div className="grid grid-cols-2 gap-4 print:hidden">
          <div className="bg-emerald-50 p-4 rounded-xl text-center border border-emerald-100">
            <p className="text-emerald-700 text-sm font-bold flex justify-center items-center gap-1">
              <Wallet size={16}/> হাতে আছে
            </p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{formatTaka(globalStats.hand)}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl text-center border border-blue-100">
            <p className="text-blue-700 text-sm font-bold flex justify-center items-center gap-1">
              <Landmark size={16}/> ব্যাংকে জমা
            </p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{formatTaka(globalStats.bank)}</p>
          </div>
        </div>
        
        <div className="mt-4 text-center print:hidden">
             <p className="text-gray-500 text-xs">মোট সম্পদ: {formatTaka(globalStats.hand + globalStats.bank)}</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 mt-6 print:px-0 print:mt-0">
        
        {/* Month Selector */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 print:border print:border-gray-300">
            <div className="flex justify-between items-center mb-4 border-b pb-3 print:hidden">
                <div className="flex items-center gap-2 font-bold text-gray-700">
                    <Filter size={18} /> মাস সিলেক্ট করুন
                </div>
                <input 
                    type="month" 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 cursor-pointer"
                />
            </div>

            {/* Monthly Summary */}
            <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2">
                    <p className="text-xs text-gray-500 mb-1">এই মাসে আয়</p>
                    <p className="text-emerald-600 font-bold">{formatTaka(monthlyStats.income)}</p>
                </div>
                <div className="p-2 border-x border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">এই মাসে খরচ</p>
                    <p className="text-rose-600 font-bold">{formatTaka(monthlyStats.expense)}</p>
                </div>
                <div className="p-2">
                    <p className="text-xs text-gray-500 mb-1">অবশিষ্ট / জমা</p>
                    <p className="text-blue-600 font-bold">{formatTaka(monthlyStats.income - monthlyStats.expense)}</p>
                </div>
            </div>
        </div>

        {/* Transaction List */}
        <h3 className="text-gray-500 font-bold mb-3 text-sm ml-1 print:text-black print:text-lg">
            বিস্তারিত লেনদেনের ইতিহাস ({monthlyTransactions.length} টি)
        </h3>
        
        {monthlyTransactions.length === 0 ? (
           <div className="text-center py-10 bg-white rounded-lg border border-dashed border-gray-300">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400">এই মাসে কোনো লেনদেন নেই</p>
           </div>
        ) : (
          <div className="space-y-3 print:space-y-0 print:border print:border-gray-300">
            {monthlyTransactions.map((t, index) => (
              <div key={t.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex justify-between items-start print:shadow-none print:rounded-none print:border-0 print:border-b print:py-2">
                
                {/* Left: Icon & Info */}
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full mt-1 print:hidden
                    ${t.type === 'remittance' ? 'bg-emerald-100 text-emerald-600' : ''}
                    ${t.type === 'expense' ? 'bg-rose-100 text-rose-600' : ''}
                    ${t.type === 'deposit' ? 'bg-blue-100 text-blue-600' : ''}
                    ${t.type === 'withdraw' ? 'bg-orange-100 text-orange-600' : ''}
                    ${t.type === 'interest' ? 'bg-amber-100 text-amber-600' : ''}
                  `}>
                    {t.type === 'remittance' && <ArrowDownCircle size={20} />}
                    {t.type === 'expense' && <ArrowUpCircle size={20} />}
                    {t.type === 'deposit' && <ArrowRight size={20} />}
                    {t.type === 'withdraw' && <ArrowRight size={20} className="rotate-180"/>}
                    {t.type === 'interest' && <Plus size={20} />}
                  </div>
                  
                  <div>
                    <p className="text-sm font-bold text-gray-800">
                        {t.type === 'remittance' && 'টাকা আসলো'}
                        {t.type === 'expense' && 'খরচ'}
                        {t.type === 'deposit' && 'ব্যাংকে জমা'}
                        {t.type === 'withdraw' && 'ব্যাংক থেকে তোলা'}
                        {t.type === 'interest' && 'ব্যাংক লাভ'}
                    </p>
                    <p className="text-xs text-gray-500 mb-1">{formatDate(t.date)}</p>
                    
                    {t.description && (
                        <p className="text-xs text-gray-600 bg-gray-50 p-1.5 rounded inline-block print:bg-transparent print:p-0 print:italic">
                            {t.description}
                        </p>
                    )}
                  </div>
                </div>

                {/* Right: Amount & Actions */}
                <div className="text-right">
                   <p className={`font-bold text-base ${
                     t.type === 'remittance' || t.type === 'interest' || t.type === 'withdraw' 
                     ? 'text-emerald-600' 
                     : (t.type === 'deposit' ? 'text-blue-600' : 'text-rose-600')
                   }`}>
                     {formatTaka(t.amount)}
                   </p>
                   
                   <div className="flex justify-end gap-2 mt-2 no-print">
                        <button 
                            onClick={() => handleEdit(t)} 
                            className="text-gray-300 hover:text-blue-500 p-1"
                        >
                            <Edit2 size={16} />
                        </button>
                        <button 
                            onClick={() => handleDelete(t.id)} 
                            className="text-gray-300 hover:text-rose-500 p-1"
                        >
                            <Trash2 size={16} />
                        </button>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button 
        onClick={resetForm}
        className="fixed bottom-6 right-6 bg-black text-white p-4 rounded-full shadow-lg flex items-center gap-2 active:scale-95 transition-transform no-print hover:bg-gray-800 z-50"
      >
        <Plus size={24} />
        <span className="font-bold pr-2">নতুন হিসাব</span>
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 no-print">
          <div className="bg-white w-full sm:w-96 p-6 rounded-t-2xl sm:rounded-xl animate-in slide-in-from-bottom duration-300">
            
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{editingId ? 'হিসাব পরিবর্তন' : 'নতুন হিসাব লিখুন'}</h2>
              <button onClick={() => setShowModal(false)} className="bg-gray-100 p-1 rounded-full text-gray-500 hover:bg-gray-200">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">লেনদেনের ধরণ</label>
                <select 
                  value={type} 
                  onChange={(e) => setType(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg font-bold text-gray-800 outline-none focus:border-black"
                >
                  <option value="remittance">মা টাকা পাঠিয়েছে (+)</option>
                  <option value="expense">আমি খরচ করেছি (-)</option>
                  <option value="deposit">ব্যাংকে জমা দিলাম (→)</option>
                  <option value="withdraw">ব্যাংক থেকে তুললাম (←)</option>
                  <option value="interest">ব্যাংকের লাভ (+)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">তারিখ</label>
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">টাকার পরিমাণ (৳)</label>
                <input 
                  type="number" 
                  placeholder="0" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full p-3 text-xl font-bold bg-white border border-gray-300 rounded-lg outline-none focus:border-black"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">নোট / বিবরণ</label>
                <input 
                  type="text" 
                  placeholder="বিবরণ লিখুন..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg outline-none"
                />
              </div>

              <button 
                type="submit" 
                disabled={isSaving}
                className="w-full bg-black text-white font-bold py-4 rounded-xl mt-4 active:scale-95 transition-transform hover:bg-gray-800 flex items-center justify-center gap-2"
              >
                {isSaving ? 'সেভ হচ্ছে...' : <><Save size={18} /> {editingId ? 'আপডেট করুন' : 'সেভ করুন'}</>}
              </button>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}