import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import {
  BookOpen,
  Sparkles,
  Layers,
  Users,
  GraduationCap,
  Play,
  RotateCw,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Shuffle,
  Search,
  CheckCircle,
  XCircle,
  Award,
  ArrowLeft,
  ArrowRight,
  LogOut,
  User,
  Settings,
  Grid,
  Check,
  Zap,
  Presentation,
  Key,
  ShieldCheck,
  RefreshCw,
  Download,
  Upload,
  Heart,
  HelpCircle,
  Star,
  FileText
} from 'lucide-react';

// --- Firebase Initialization ---
const firebaseConfig = typeof __firebase_config !== 'undefined'
  ? JSON.parse(__firebase_config)
  : {
      apiKey: "demo-api-key",
      authDomain: "demo-project.firebaseapp.com",
      projectId: "demo-project",
      storageBucket: "demo-project.appspot.com",
      messagingSenderId: "123456789",
      appId: "1:123456789:web:abcdef123456"
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'cute-flashcards-app';

// Default Demo Sets if Firestore is empty
const INITIAL_DEMO_SETS = [
  {
    title: "คำศัพท์ภาษาอังกฤษน่ารู้ (English Vocab 101)",
    description: "ชุดคำศัพท์พื้นฐานสำหรับนักเรียนประถมศึกษา พร้อมภาพและระดับความยาก",
    category: "ภาษาอังกฤษ",
    difficulty: "ง่าย",
    cards: [
      { id: "c1", front: "Butterfly", back: "ผีเสื้อ", difficulty: "ง่าย", imageUrl: "https://images.unsplash.com/photo-1557008075-7f2c5efa4cfd?w=400&auto=format&fit=crop&q=60" },
      { id: "c2", front: "Sunflower", back: "ดอกทานตะวัน", difficulty: "ง่าย", imageUrl: "https://images.unsplash.com/photo-1597848212624-a19eb35e2651?w=400&auto=format&fit=crop&q=60" },
      { id: "c3", front: "Rainbow", back: "รุ้งกินน้ำ", difficulty: "ปานกลาง", imageUrl: "https://images.unsplash.com/photo-1508624217792-be2243d5c643?w=400&auto=format&fit=crop&q=60" },
      { id: "c4", front: "Adventure", back: "การผจญภัย", difficulty: "ยาก", imageUrl: "" }
    ]
  },
  {
    title: "ระบบสุริยะจักรวาล (Solar System)",
    description: "บทเรียนวิทยาศาสตร์เกี่ยวกับดาวเคราะห์ต่าง ๆ ในระบบสุริยะ",
    category: "วิทยาศาสตร์",
    difficulty: "ปานกลาง",
    cards: [
      { id: "c5", front: "Sun", back: "ดวงอาทิตย์ (ศูนย์กลางของระบบสุริยะ)", difficulty: "ง่าย", imageUrl: "" },
      { id: "c6", front: "Jupiter", back: "ดาวพฤหัสบดี (ดาวเคราะห์ที่ใหญ่ที่สุด)", difficulty: "ยาก", imageUrl: "" },
      { id: "c7", front: "Mars", back: "ดาวอังคาร (ดาวเคราะห์แดง)", difficulty: "ปานกลาง", imageUrl: "" }
    ]
  }
];

export default function App() {
  // Auth & User State
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('teacher'); // 'teacher' or 'student'
  const [displayName, setDisplayName] = useState('');
  const [studentCodeInput, setStudentCodeInput] = useState('');

  // App Navigation State
  const [currentView, setCurrentView] = useState('dashboard'); // login, dashboard, set-list, set-editor, study, quiz, match, presentation, rooms, profile, report
  const [selectedSet, setSelectedSet] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);

  // Firestore Data Collections
  const [flashcardSets, setFlashcardSets] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [learningStats, setLearningStats] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form & Interaction States
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ทั้งหมด');
  const [modalConfirm, setModalConfirm] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [notification, setNotification] = useState(null);

  // Show Toast Notifications
  const showToast = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // 1. Authenticate user on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        const storedRole = localStorage.getItem(`role_${u.uid}`) || 'teacher';
        const storedName = localStorage.getItem(`name_${u.uid}`) || (storedRole === 'teacher' ? 'คุณครูสุดใจดี' : 'นักเรียนน่ารัก');
        setRole(storedRole);
        setDisplayName(storedName);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Public Collections from Firestore
  useEffect(() => {
    if (!user) return;

    // Sets listener
    const setsColl = collection(db, 'artifacts', appId, 'public', 'data', 'flashcard_sets');
    const unsubSets = onSnapshot(setsColl, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (docs.length === 0) {
        // Seed initial data if database is empty
        INITIAL_DEMO_SETS.forEach(async (set) => {
          await addDoc(setsColl, { ...set, createdAt: Date.now(), authorId: user.uid });
        });
      } else {
        setFlashcardSets(docs);
      }
    }, (err) => console.error("Sets fetch error:", err));

    // Rooms listener
    const roomsColl = collection(db, 'artifacts', appId, 'public', 'data', 'classroom_rooms');
    const unsubRooms = onSnapshot(roomsColl, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRooms(docs);
    }, (err) => console.error("Rooms fetch error:", err));

    // Stats listener
    const statsColl = collection(db, 'artifacts', appId, 'public', 'data', 'learning_stats');
    const unsubStats = onSnapshot(statsColl, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLearningStats(docs);
    }, (err) => console.error("Stats fetch error:", err));

    return () => {
      unsubSets();
      unsubRooms();
      unsubStats();
    };
  }, [user]);

  // Handle Switch User Role
  const handleRoleSwitch = (newRole) => {
    setRole(newRole);
    if (user) {
      localStorage.setItem(`role_${user.uid}`, newRole);
      const defaultName = newRole === 'teacher' ? 'คุณครูสุดใจดี' : 'นักเรียนคนขยัน';
      setDisplayName(defaultName);
      localStorage.setItem(`name_${user.uid}`, defaultName);
    }
    showToast(`เปลี่ยนเป็นโหมด ${newRole === 'teacher' ? 'คุณครู' : 'นักเรียน'} เรียบร้อย!`);
  };

  // Save Learning Progress to Firestore
  const saveLearningProgress = async (setId, mode, score, total) => {
    if (!user) return;
    try {
      const statsColl = collection(db, 'artifacts', appId, 'public', 'data', 'learning_stats');
      await addDoc(statsColl, {
        userId: user.uid,
        userName: displayName || 'นักเรียน',
        setId,
        mode,
        score,
        total,
        percentage: Math.round((score / total) * 100),
        timestamp: Date.now()
      });
      showToast("บันทึกผลการเรียนรู้เรียบร้อยแล้ว! ✨");
    } catch (e) {
      console.error("Save stats error:", e);
    }
  };

  // Create or Update Flashcard Set
  const handleSaveSet = async (setData) => {
    try {
      const setsColl = collection(db, 'artifacts', appId, 'public', 'data', 'flashcard_sets');
      if (setData.id) {
        const ref = doc(db, 'artifacts', appId, 'public', 'data', 'flashcard_sets', setData.id);
        await updateDoc(ref, {
          title: setData.title,
          description: setData.description,
          category: setData.category,
          difficulty: setData.difficulty,
          cards: setData.cards,
          updatedAt: Date.now()
        });
        showToast("บันทึกการแก้ไขเรียบร้อยแล้ว 🎉");
      } else {
        await addDoc(setsColl, {
          ...setData,
          createdAt: Date.now(),
          authorId: user ? user.uid : 'anon',
          authorName: displayName || 'คุณครู'
        });
        showToast("สร้างชุด Flashcard ใหม่สำเร็จ! 🌟");
      }
      setCurrentView('set-list');
    } catch (err) {
      showToast("เกิดข้อผิดพลาดในการบันทึก", "error");
    }
  };

  // Delete Flashcard Set
  const handleDeleteSet = (setId) => {
    setModalConfirm({
      open: true,
      title: "ยืนยันการลบชุดคำศัพท์",
      message: "คุณแน่ใจหรือไม่ว่าต้องการลบชุด Flashcard นี้? ข้อมูลจะไม่สามารถกู้คืนได้",
      onConfirm: async () => {
        try {
          const ref = doc(db, 'artifacts', appId, 'public', 'data', 'flashcard_sets', setId);
          await deleteDoc(ref);
          showToast("ลบชุด Flashcard แล้ว");
        } catch (e) {
          showToast("ลบไม่สำเร็จ", "error");
        }
      }
    });
  };

  // Quick Duplicate Set
  const handleDuplicateSet = async (setObj) => {
    try {
      const setsColl = collection(db, 'artifacts', appId, 'public', 'data', 'flashcard_sets');
      const duplicated = {
        title: `${setObj.title} (สำเนา)`,
        description: setObj.description,
        category: setObj.category,
        difficulty: setObj.difficulty,
        cards: setObj.cards.map(c => ({ ...c, id: 'c_' + Math.random().toString(36).substr(2, 9) })),
        createdAt: Date.now(),
        authorId: user ? user.uid : 'anon',
        authorName: displayName
      };
      await addDoc(setsColl, duplicated);
      showToast("คัดลอกชุดคำศัพท์สำเร็จ!");
    } catch (e) {
      showToast("ไม่สามารถคัดลอกได้", "error");
    }
  };

  // Filtered Flashcard Sets
  const filteredSets = useMemo(() => {
    return flashcardSets.filter(s => {
      const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = categoryFilter === 'ทั้งหมด' || s.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [flashcardSets, searchQuery, categoryFilter]);

  // Categories list
  const categories = useMemo(() => {
    const cats = new Set(flashcardSets.map(s => s.category).filter(Boolean));
    return ['ทั้งหมด', ...Array.from(cats)];
  }, [flashcardSets]);

  if (loading) {
    return (
      <div className="min-h-screen bg-pink-50/50 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 border-4 border-pink-300 border-t-pink-500 rounded-full animate-spin"></div>
        <p className="mt-4 font-bold text-pink-600 animate-pulse text-lg">กำลังโหลด Flashcards น่ารักๆ...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-slate-700 font-sans flex flex-col selection:bg-pink-200">
      {/* --- Header / Navigation Bar --- */}
      <header className="bg-white/80 backdrop-blur-md border-b border-pink-100 sticky top-0 z-40 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo & Brand */}
          <div 
            onClick={() => setCurrentView('dashboard')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-400 to-purple-400 flex items-center justify-center shadow-md shadow-pink-200 group-hover:scale-105 transition-transform">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-xl bg-gradient-to-r from-pink-500 via-purple-500 to-sky-400 bg-clip-text text-transparent">
                CuteCards
              </h1>
              <p className="text-xs text-slate-400 font-medium">Minimal Flashcard Learning</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                currentView === 'dashboard' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-600 hover:text-pink-500'
              }`}
            >
              แดชบอร์ด
            </button>
            <button
              onClick={() => setCurrentView('set-list')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                ['set-list', 'set-editor', 'study', 'quiz', 'match'].includes(currentView)
                  ? 'bg-white text-pink-600 shadow-sm'
                  : 'text-slate-600 hover:text-pink-500'
              }`}
            >
              ชุด Flashcard
            </button>
            <button
              onClick={() => setCurrentView('rooms')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                currentView === 'rooms' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-600 hover:text-pink-500'
              }`}
            >
              ห้องเรียน
            </button>
            {role === 'teacher' && (
              <button
                onClick={() => setCurrentView('report')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  currentView === 'report' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-600 hover:text-pink-500'
                }`}
              >
                รายงานผล
              </button>
            )}
          </nav>

          {/* User Profile & Role Switcher */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-pink-50/80 p-1 rounded-2xl border border-pink-100">
              <button
                onClick={() => handleRoleSwitch('teacher')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  role === 'teacher' ? 'bg-pink-400 text-white shadow-sm' : 'text-slate-500 hover:text-pink-500'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                คุณครู
              </button>
              <button
                onClick={() => handleRoleSwitch('student')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  role === 'student' ? 'bg-sky-400 text-white shadow-sm' : 'text-slate-500 hover:text-sky-500'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                นักเรียน
              </button>
            </div>

            <button
              onClick={() => setCurrentView('profile')}
              className="p-2 rounded-2xl bg-white border border-slate-100 hover:bg-slate-50 text-slate-600 transition-all shadow-sm flex items-center gap-2"
              title="ตั้งค่าโปรไฟล์"
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-xs ${
                role === 'teacher' ? 'bg-pink-400' : 'bg-sky-400'
              }`}>
                {displayName.charAt(0) || 'U'}
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* --- Main Content Area --- */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8">
        
        {/* Toast Notification */}
        {notification && (
          <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border text-sm font-semibold transition-all animate-bounce ${
            notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            <Sparkles className="w-5 h-5 text-current" />
            <span>{notification.msg}</span>
          </div>
        )}

        {/* Dynamic Views */}
        {currentView === 'dashboard' && (
          <DashboardView
            flashcardSets={flashcardSets}
            rooms={rooms}
            learningStats={learningStats}
            role={role}
            userName={displayName}
            onNavigate={(view, set) => {
              if (set) setSelectedSet(set);
              setCurrentView(view);
            }}
          />
        )}

        {currentView === 'set-list' && (
          <SetListView
            sets={filteredSets}
            categories={categories}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            role={role}
            onSelectSet={(set, mode) => {
              setSelectedSet(set);
              setCurrentView(mode); // 'study', 'quiz', 'match', 'presentation', 'set-editor'
            }}
            onCreateNew={() => {
              setSelectedSet(null);
              setCurrentView('set-editor');
            }}
            onDuplicateSet={handleDuplicateSet}
            onDeleteSet={handleDeleteSet}
          />
        )}

        {currentView === 'set-editor' && (
          <SetEditorView
            initialSet={selectedSet}
            onSave={handleSaveSet}
            onCancel={() => setCurrentView('set-list')}
          />
        )}

        {currentView === 'study' && selectedSet && (
          <StudyModeView
            set={selectedSet}
            onBack={() => setCurrentView('set-list')}
            onFinish={(score, total) => saveLearningProgress(selectedSet.id, 'Study', score, total)}
          />
        )}

        {currentView === 'quiz' && selectedSet && (
          <QuizModeView
            set={selectedSet}
            onBack={() => setCurrentView('set-list')}
            onFinish={(score, total) => saveLearningProgress(selectedSet.id, 'Quiz', score, total)}
          />
        )}

        {currentView === 'match' && selectedSet && (
          <MatchingModeView
            set={selectedSet}
            onBack={() => setCurrentView('set-list')}
            onFinish={(score, total) => saveLearningProgress(selectedSet.id, 'Matching', score, total)}
          />
        )}

        {currentView === 'presentation' && selectedSet && (
          <PresentationModeView
            set={selectedSet}
            onBack={() => setCurrentView('set-list')}
          />
        )}

        {currentView === 'rooms' && (
          <ClassroomsView
            rooms={rooms}
            sets={flashcardSets}
            role={role}
            user={user}
            userName={displayName}
            onSelectSet={(set, mode) => {
              setSelectedSet(set);
              setCurrentView(mode);
            }}
            showToast={showToast}
          />
        )}

        {currentView === 'report' && (
          <ReportView
            stats={learningStats}
            sets={flashcardSets}
          />
        )}

        {currentView === 'profile' && (
          <ProfileView
            userName={displayName}
            setUserName={setDisplayName}
            role={role}
            setRole={handleRoleSwitch}
            user={user}
            showToast={showToast}
          />
        )}

      </main>

      {/* --- Confirmation Modal --- */}
      {modalConfirm.open && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-pink-100 animate-in fade-in zoom-in-95">
            <h3 className="text-xl font-bold text-slate-800 mb-2">{modalConfirm.title}</h3>
            <p className="text-slate-600 text-sm mb-6">{modalConfirm.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setModalConfirm({ ...modalConfirm, open: false })}
                className="px-4 py-2 rounded-xl text-slate-500 font-medium hover:bg-slate-100 transition-all"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  if (modalConfirm.onConfirm) modalConfirm.onConfirm();
                  setModalConfirm({ ...modalConfirm, open: false });
                }}
                className="px-5 py-2 rounded-xl bg-pink-500 text-white font-medium hover:bg-pink-600 shadow-md shadow-pink-200 transition-all"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Footer --- */}
      <footer className="bg-white border-t border-slate-100 py-6 text-center text-xs text-slate-400 mt-auto">
        <p className="flex items-center justify-center gap-1">
          ออกแบบด้วยความรักสำหรับชั้นเรียนยุคใหม่ <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400" /> Minimal Cute Flashcards
        </p>
      </footer>
    </div>
  );
}

/* ==========================================
   1. DASHBOARD VIEW
========================================== */
function DashboardView({ flashcardSets, rooms, learningStats, role, userName, onNavigate }) {
  const totalCards = useMemo(() => {
    return flashcardSets.reduce((sum, s) => sum + (s.cards ? s.cards.length : 0), 0);
  }, [flashcardSets]);

  const recentSets = useMemo(() => flashcardSets.slice(0, 3), [flashcardSets]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-pink-300 via-purple-300 to-sky-300 p-8 shadow-xl text-white">
        <div className="relative z-10 max-w-2xl">
          <span className="bg-white/30 backdrop-blur-md px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider text-white">
            {role === 'teacher' ? '👨‍🏫 โหมดคุณครู' : '🎓 โหมดนักเรียน'}
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold mt-3 leading-tight drop-shadow-sm">
            สวัสดีจ้า, {userName || 'เพื่อนๆ'}! ✨
          </h2>
          <p className="mt-2 text-white/90 text-sm md:text-base font-medium">
            {role === 'teacher' 
              ? 'พร้อมเริ่มการเรียนการสอนวันนี้หรือยัง? สร้าง Flashcard ใหม่ หรือเปิดห้องเรียนได้เลย!'
              : 'พร้อมสำหรับการทบทวนคำศัพท์สนุกๆ ในวันนี้หรือยัง? เลือกโหมดเรียนรู้ได้เลย!'}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {role === 'teacher' ? (
              <button
                onClick={() => onNavigate('set-editor', null)}
                className="px-5 py-2.5 rounded-2xl bg-white text-pink-600 font-bold hover:bg-pink-50 transition-all shadow-md flex items-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" /> สร้าง Flashcard ใหม่
              </button>
            ) : (
              <button
                onClick={() => onNavigate('rooms', null)}
                className="px-5 py-2.5 rounded-2xl bg-white text-sky-600 font-bold hover:bg-sky-50 transition-all shadow-md flex items-center gap-2 text-sm"
              >
                <Key className="w-4 h-4" /> เข้าร่วมห้องเรียน
              </button>
            )}
            <button
              onClick={() => onNavigate('set-list', null)}
              className="px-5 py-2.5 rounded-2xl bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-bold transition-all text-sm"
            >
              ดูชุดการเรียนทั้งหมด
            </button>
          </div>
        </div>

        {/* Decorative Circles */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute top-4 right-10 w-24 h-24 bg-purple-400/30 rounded-full blur-xl pointer-events-none" />
      </div>

      {/* Key Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-pink-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-pink-100 text-pink-500 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">ชุด Flashcard</p>
            <p className="text-2xl font-black text-slate-700">{flashcardSets.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-purple-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-500 flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">คำศัพท์ทั้งหมด</p>
            <p className="text-2xl font-black text-slate-700">{totalCards}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-sky-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-500 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">ห้องเรียน актив</p>
            <p className="text-2xl font-black text-slate-700">{rooms.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-emerald-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-500 flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">กิจกรรมที่ทำแล้ว</p>
            <p className="text-2xl font-black text-slate-700">{learningStats.length}</p>
          </div>
        </div>
      </div>

      {/* Recent Flashcard Sets Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-400" /> ชุด Flashcard ล่าสุด
          </h3>
          <button
            onClick={() => onNavigate('set-list', null)}
            className="text-sm font-semibold text-pink-500 hover:underline"
          >
            ดูทั้งหมด ({flashcardSets.length})
          </button>
        </div>

        {recentSets.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
            <Layers className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="font-medium">ยังไม่มีชุด Flashcard ในระบบ</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {recentSets.map((set) => (
              <div
                key={set.id}
                className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-pink-50 text-pink-500 border border-pink-100">
                      {set.category || 'ทั่วไป'}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {set.cards ? set.cards.length : 0} การ์ด
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-lg group-hover:text-pink-500 transition-colors line-clamp-1">
                    {set.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {set.description || 'ไม่มีคำอธิบายเพิ่มเติม'}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-50 flex items-center gap-2">
                  <button
                    onClick={() => onNavigate('study', set)}
                    className="flex-1 py-2 rounded-xl bg-pink-50 text-pink-600 font-bold hover:bg-pink-100 text-xs transition-all flex items-center justify-center gap-1"
                  >
                    <BookOpen className="w-3.5 h-3.5" /> เรียนรู้
                  </button>
                  <button
                    onClick={() => onNavigate('quiz', set)}
                    className="flex-1 py-2 rounded-xl bg-purple-50 text-purple-600 font-bold hover:bg-purple-100 text-xs transition-all flex items-center justify-center gap-1"
                  >
                    <Zap className="w-3.5 h-3.5" /> ควิซ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

/* ==========================================
   2. SET LIST VIEW
========================================== */
function SetListView({
  sets,
  categories,
  searchQuery,
  setSearchQuery,
  categoryFilter,
  setCategoryFilter,
  role,
  onSelectSet,
  onCreateNew,
  onDuplicateSet,
  onDeleteSet
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800">คลัง Flashcard ของคุณ 📚</h2>
          <p className="text-slate-500 text-sm">เลือกชุด Flashcard เพื่อเริ่มเรียนรู้ หรือสร้างชุดใหม่</p>
        </div>

        {role === 'teacher' && (
          <button
            onClick={onCreateNew}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-400 text-white font-bold hover:opacity-95 shadow-md shadow-pink-200 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> สร้างชุด Flashcard
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3 items-center">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหาชื่อชุดFlashcard หรือคำอธิบาย..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-transparent focus:border-pink-300 focus:bg-white text-sm outline-none transition-all"
          />
        </div>

        {/* Categories Chips */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                categoryFilter === cat
                  ? 'bg-pink-400 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Grid */}
      {sets.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center text-slate-400">
          <Layers className="w-16 h-16 mx-auto mb-3 opacity-30 text-pink-400" />
          <h3 className="text-lg font-bold text-slate-600">ไม่พบชุด Flashcard</h3>
          <p className="text-sm text-slate-400 mt-1">ลองเปลี่ยนคำค้นหา หรือสร้างชุดใหม่เลย!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sets.map((set) => (
            <div
              key={set.id}
              className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between group relative overflow-hidden"
            >
              {/* Category & Badge */}
              <div className="flex justify-between items-start mb-3">
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-pink-50 text-pink-500 border border-pink-100">
                  {set.category || 'ทั่วไป'}
                </span>
                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                  {set.cards ? set.cards.length : 0} คำศัพท์
                </span>
              </div>

              {/* Title & Desc */}
              <div className="mb-6">
                <h3 className="font-bold text-xl text-slate-800 group-hover:text-pink-500 transition-colors">
                  {set.title}
                </h3>
                <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                  {set.description || 'ไม่มีรายละเอียดบทเรียนเพิ่มเติม'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-4 border-t border-slate-50">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => onSelectSet(set, 'study')}
                    className="py-2.5 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-600 font-extrabold text-xs transition-all flex flex-col items-center justify-center gap-1"
                  >
                    <BookOpen className="w-4 h-4" />
                    Study
                  </button>
                  <button
                    onClick={() => onSelectSet(set, 'quiz')}
                    className="py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-600 font-extrabold text-xs transition-all flex flex-col items-center justify-center gap-1"
                  >
                    <Zap className="w-4 h-4" />
                    Quiz
                  </button>
                  <button
                    onClick={() => onSelectSet(set, 'match')}
                    className="py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-600 font-extrabold text-xs transition-all flex flex-col items-center justify-center gap-1"
                  >
                    <Grid className="w-4 h-4" />
                    Match
                  </button>
                </div>

                {/* Presentation & Management Toolbar */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => onSelectSet(set, 'presentation')}
                    className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs flex items-center gap-1 transition-all"
                    title="เปิดโหมดนำเสนอหน้าชั้นเรียน"
                  >
                    <Presentation className="w-3.5 h-3.5" /> โหมดฉายจอ
                  </button>

                  {role === 'teacher' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onDuplicateSet(set)}
                        className="p-1.5 text-slate-400 hover:text-purple-500 rounded-lg hover:bg-purple-50 transition-all"
                        title="คัดลอกชุดการ์ด"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onSelectSet(set, 'set-editor')}
                        className="p-1.5 text-slate-400 hover:text-pink-500 rounded-lg hover:bg-pink-50 transition-all"
                        title="แก้ไขการ์ด"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteSet(set.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"
                        title="ลบชุดนี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==========================================
   3. SET EDITOR VIEW (CREATE & EDIT)
========================================== */
function SetEditorView({ initialSet, onSave, onCancel }) {
  const [title, setTitle] = useState(initialSet?.title || '');
  const [description, setDescription] = useState(initialSet?.description || '');
  const [category, setCategory] = useState(initialSet?.category || 'ทั่วไป');
  const [cards, setCards] = useState(
    initialSet?.cards || [
      { id: 'c1', front: '', back: '', difficulty: 'ง่าย', imageUrl: '' }
    ]
  );

  const handleAddCard = () => {
    setCards([
      ...cards,
      { id: 'c_' + Math.random().toString(36).substr(2, 9), front: '', back: '', difficulty: 'ง่าย', imageUrl: '' }
    ]);
  };

  const handleCardChange = (idx, field, val) => {
    const updated = [...cards];
    updated[idx][field] = val;
    setCards(updated);
  };

  const handleRemoveCard = (idx) => {
    if (cards.length === 1) {
      alert("ชุดคำศัพท์ต้องมีอย่างน้อย 1 การ์ด");
      return;
    }
    setCards(cards.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("กรุณากรอกชื่อชุด Flashcard");
      return;
    }
    const validCards = cards.filter(c => c.front.trim() && c.back.trim());
    if (validCards.length === 0) {
      alert("กรุณากรอกข้อมูลหน้า-หลังการ์ด อย่างน้อย 1 ใบ");
      return;
    }

    onSave({
      id: initialSet?.id,
      title,
      description,
      category,
      cards: validCards
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800">
            {initialSet ? 'แก้ไขชุด Flashcard' : 'สร้างชุด Flashcard ใหม่ 🎨'}
          </h2>
          <p className="text-slate-500 text-sm">เพิ่มคำศัพท์ รูปภาพ และคำอธิบายสำหรับการเรียนรู้</p>
        </div>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-semibold text-sm transition-all"
        >
          ยกเลิก
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General Details */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ชื่อชุดบทเรียน</label>
            <input
              type="text"
              required
              placeholder="เช่น คำศัพท์หมวดสัตว์น่ารัก (Animals)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-pink-300 text-sm outline-none font-bold text-slate-800 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">หมวดหมู่</label>
              <input
                type="text"
                placeholder="เช่น ภาษาอังกฤษ, วิทยาศาสตร์"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-pink-300 text-sm outline-none font-medium transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">คำอธิบายสั้นๆ</label>
              <input
                type="text"
                placeholder="อธิบายเนื้อหาโดยรวม..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-pink-300 text-sm outline-none font-medium transition-all"
              />
            </div>
          </div>
        </div>

        {/* Card Editor List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-slate-800">รายการ Flashcard ({cards.length})</h3>
            <button
              type="button"
              onClick={handleAddCard}
              className="px-4 py-2 rounded-xl bg-pink-50 text-pink-600 hover:bg-pink-100 font-extrabold text-xs transition-all flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> เพิ่มการ์ด
            </button>
          </div>

          {cards.map((card, idx) => (
            <div key={card.id || idx} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3 relative group">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-pink-500 bg-pink-50 px-3 py-1 rounded-full">
                  การ์ดที่ {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveCard(idx)}
                  className="text-slate-400 hover:text-red-500 p-1 transition-all"
                  title="ลบการ์ดนี้"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">ด้านหน้า (คำถาม / คำศัพท์)</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="เช่น Apple"
                    value={card.front}
                    onChange={(e) => handleCardChange(idx, 'front', e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 focus:bg-white focus:border-pink-300 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">ด้านหลัง (คำตอบ / คำแปล)</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="เช่น แอปเปิ้ล"
                    value={card.back}
                    onChange={(e) => handleCardChange(idx, 'back', e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-800 focus:bg-white focus:border-pink-300 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">URL รูปภาพประกอบ (ถ้ามี)</label>
                  <input
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={card.imageUrl || ''}
                    onChange={(e) => handleCardChange(idx, 'imageUrl', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">ระดับความยาก</label>
                  <select
                    value={card.difficulty || 'ง่าย'}
                    onChange={(e) => handleCardChange(idx, 'difficulty', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none transition-all"
                  >
                    <option value="ง่าย">ง่าย 😊</option>
                    <option value="ปานกลาง">ปานกลาง 🤔</option>
                    <option value="ยาก">ยาก 🤓</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Submit Bar */}
        <div className="pt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 rounded-2xl text-slate-600 font-bold hover:bg-slate-100 transition-all text-sm"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="px-8 py-3 rounded-2xl bg-pink-500 text-white font-extrabold hover:bg-pink-600 shadow-lg shadow-pink-200 transition-all text-sm"
          >
            บันทึก Flashcard ทั้งหมด ✨
          </button>
        </div>
      </form>
    </div>
  );
}

/* ==========================================
   4. STUDY MODE (FLIP CARDS)
========================================== */
function StudyModeView({ set, onBack, onFinish }) {
  const [cards, setCards] = useState(set.cards || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [completed, setCompleted] = useState(false);

  const currentCard = cards[currentIndex];

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleNext = () => {
    setIsFlipped(false);
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCompleted(true);
      onFinish(cards.length, cards.length);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setCurrentIndex(prev => prev - 1);
    }
  };

  if (completed) {
    return (
      <div className="max-w-md mx-auto bg-white p-8 rounded-3xl border border-pink-100 shadow-xl text-center space-y-6 animate-in zoom-in-95">
        <div className="w-20 h-20 bg-pink-100 rounded-full flex items-center justify-center mx-auto text-pink-500">
          <Sparkles className="w-10 h-10 animate-bounce" />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800">เรียนรู้ครบทุกคำศัพท์แล้ว! 🎉</h2>
          <p className="text-slate-500 text-sm mt-2">เก่งมากเลย คุณได้เรียนรู้ชุดคำศัพท์ "{set.title}" ครบเรียบร้อย</p>
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => {
              setCompleted(false);
              setCurrentIndex(0);
              setIsFlipped(false);
            }}
            className="px-5 py-2.5 rounded-2xl bg-pink-50 text-pink-600 font-bold text-sm hover:bg-pink-100 transition-all"
          >
            ทบทวนอีกครั้ง
          </button>
          <button
            onClick={onBack}
            className="px-5 py-2.5 rounded-2xl bg-pink-500 text-white font-bold text-sm shadow-md hover:bg-pink-600 transition-all"
          >
            กลับหน้าชุด Flashcard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Top Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-500 font-semibold hover:text-pink-500 text-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
        </button>
        <span className="text-xs font-bold text-pink-500 bg-pink-50 px-3 py-1 rounded-full border border-pink-100">
          {currentIndex + 1} / {cards.length} การ์ด
        </span>
        <button
          onClick={handleShuffle}
          className="flex items-center gap-1.5 text-purple-600 font-semibold hover:text-purple-700 bg-purple-50 px-3 py-1.5 rounded-xl text-xs transition-all"
        >
          <Shuffle className="w-3.5 h-3.5" /> สุ่มการ์ด
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
        <div
          className="bg-gradient-to-r from-pink-400 to-purple-400 h-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
        />
      </div>

      {/* Interactive 3D Flip Card */}
      <div
        onClick={() => setIsFlipped(!isFlipped)}
        className="w-full h-80 md:h-96 cursor-pointer perspective-1000 select-none group"
      >
        <div
          className={`w-full h-full duration-500 transform-style-3d transition-transform relative rounded-3xl shadow-lg border border-pink-100 bg-white ${
            isFlipped ? 'rotate-y-180 bg-gradient-to-tr from-pink-50/50 to-purple-50/50' : ''
          }`}
        >
          {/* Card Front */}
          <div className="absolute inset-0 backface-hidden p-8 flex flex-col items-center justify-center text-center">
            <span className="absolute top-4 left-4 text-xs font-extrabold text-slate-300 uppercase tracking-wider">
              ด้านหน้า (คำศัพท์)
            </span>
            {currentCard?.imageUrl && (
              <img
                src={currentCard.imageUrl}
                alt={currentCard.front}
                className="w-28 h-28 object-cover rounded-2xl mb-4 shadow-sm"
              />
            )}
            <h2 className="text-3xl md:text-4xl font-black text-slate-800">{currentCard?.front}</h2>
            <p className="mt-6 text-xs text-slate-400 flex items-center gap-1">
              <RotateCw className="w-3.5 h-3.5" /> คลิกเพื่อพลิกดูคำตอบ
            </p>
          </div>

          {/* Card Back */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 p-8 flex flex-col items-center justify-center text-center">
            <span className="absolute top-4 left-4 text-xs font-extrabold text-pink-400 uppercase tracking-wider">
              ด้านหลัง (คำตอบ)
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-pink-600">{currentCard?.back}</h2>
            {currentCard?.difficulty && (
              <span className="mt-4 text-xs font-semibold bg-pink-100 text-pink-600 px-3 py-1 rounded-full">
                ระดับความยาก: {currentCard.difficulty}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between pt-4">
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 font-bold text-sm disabled:opacity-40 shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> ก่อนหน้า
        </button>

        <button
          onClick={handleNext}
          className="px-8 py-3 rounded-2xl bg-pink-500 text-white font-extrabold text-sm shadow-md shadow-pink-200 hover:bg-pink-600 transition-all flex items-center gap-2"
        >
          {currentIndex === cards.length - 1 ? 'เสร็จสิ้น ✨' : 'ถัดไป'} <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}

/* ==========================================
   5. QUIZ MODE (MULTIPLE CHOICE)
========================================== */
function QuizModeView({ set, onBack, onFinish }) {
  const [cards] = useState(set.cards || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);

  // Generate 4 multiple choice options for current card
  const currentCard = cards[currentIndex];
  
  const options = useMemo(() => {
    if (!currentCard) return [];
    const correct = currentCard.back;
    const others = cards.filter(c => c.back !== correct).map(c => c.back);
    // Shuffle others
    const shuffledOthers = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
    const combined = [correct, ...shuffledOthers];
    return combined.sort(() => Math.random() - 0.5);
  }, [currentIndex, cards]);

  const handleSelectOption = (opt) => {
    if (isAnswered) return;
    setSelectedOption(opt);
    setIsAnswered(true);
    if (opt === currentCard.back) {
      setScore(prev => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setQuizFinished(true);
      onFinish(score, cards.length);
    }
  };

  if (quizFinished) {
    const percentage = Math.round((score / cards.length) * 100);
    return (
      <div className="max-w-md mx-auto bg-white p-8 rounded-3xl border border-purple-100 shadow-xl text-center space-y-6 animate-in zoom-in-95">
        <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto text-purple-600">
          <Award className="w-10 h-10" />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800">สรุปผลแบบทดสอบ 🏆</h2>
          <p className="text-slate-500 text-sm mt-1">ชุดคำศัพท์: {set.title}</p>
          <div className="my-6 p-4 bg-purple-50 rounded-2xl border border-purple-100">
            <p className="text-4xl font-black text-purple-600">{score} / {cards.length}</p>
            <p className="text-xs font-bold text-purple-400 mt-1">คะแนนรวม ({percentage}%)</p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="w-full py-3 rounded-2xl bg-purple-600 text-white font-extrabold shadow-md hover:bg-purple-700 transition-all text-sm"
        >
          กลับสู่คลังคำศัพท์
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-slate-500 text-sm font-bold flex items-center gap-1 hover:text-purple-600">
          <ArrowLeft className="w-4 h-4" /> ออกจาก Quiz
        </button>
        <span className="text-xs font-extrabold text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
          ข้อที่ {currentIndex + 1} จาก {cards.length}
        </span>
      </div>

      {/* Quiz Card Question */}
      <div className="bg-white p-8 rounded-3xl border border-purple-100 shadow-md text-center">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">คำถาม</span>
        <h2 className="text-3xl font-black text-slate-800 mt-2">{currentCard?.front}</h2>
      </div>

      {/* Answer Choices */}
      <div className="grid grid-cols-1 gap-3">
        {options.map((opt, i) => {
          let btnStyle = "bg-white border-slate-200 text-slate-700 hover:border-purple-300";
          if (isAnswered) {
            if (opt === currentCard.back) {
              btnStyle = "bg-emerald-500 border-emerald-500 text-white font-bold";
            } else if (opt === selectedOption) {
              btnStyle = "bg-red-400 border-red-400 text-white font-bold";
            } else {
              btnStyle = "bg-slate-50 text-slate-400 border-transparent";
            }
          }

          return (
            <button
              key={i}
              onClick={() => handleSelectOption(opt)}
              disabled={isAnswered}
              className={`p-4 rounded-2xl border text-left text-sm font-semibold transition-all flex items-center justify-between ${btnStyle}`}
            >
              <span>{opt}</span>
              {isAnswered && opt === currentCard.back && <CheckCircle className="w-5 h-5 text-white" />}
              {isAnswered && opt === selectedOption && opt !== currentCard.back && <XCircle className="w-5 h-5 text-white" />}
            </button>
          );
        })}
      </div>

      {/* Next Button */}
      {isAnswered && (
        <button
          onClick={handleNextQuestion}
          className="w-full py-3.5 rounded-2xl bg-purple-600 text-white font-extrabold shadow-lg shadow-purple-200 hover:bg-purple-700 transition-all flex items-center justify-center gap-2 text-sm"
        >
          ข้อถัดไป <ArrowRight className="w-4 h-4" />
        </button>
      )}

    </div>
  );
}

/* ==========================================
   6. MATCHING MODE (CARD MATCHING GAME)
========================================== */
function MatchingModeView({ set, onBack, onFinish }) {
  const [cards, setCards] = useState([]);
  const [selectedFirst, setSelectedFirst] = useState(null);
  const [matchedIds, setMatchedIds] = useState([]);
  const [moves, setMoves] = useState(0);

  useEffect(() => {
    // Generate split list of Front and Back cards
    const frontItems = set.cards.map(c => ({ id: c.id, text: c.front, type: 'front' }));
    const backItems = set.cards.map(c => ({ id: c.id, text: c.back, type: 'back' }));
    const combined = [...frontItems, ...backItems].sort(() => Math.random() - 0.5);
    setCards(combined);
  }, [set]);

  const handleCardClick = (item) => {
    if (matchedIds.includes(item.id)) return;
    if (selectedFirst && selectedFirst.uniqueIndex === item.uniqueIndex) return;

    if (!selectedFirst) {
      setSelectedFirst(item);
    } else {
      setMoves(prev => prev + 1);
      // Check if match
      if (selectedFirst.id === item.id && selectedFirst.type !== item.type) {
        setMatchedIds(prev => [...prev, item.id]);
        setSelectedFirst(null);
      } else {
        setTimeout(() => setSelectedFirst(null), 700);
      }
    }
  };

  const isGameComplete = matchedIds.length === set.cards.length;

  useEffect(() => {
    if (isGameComplete && set.cards.length > 0) {
      onFinish(set.cards.length, set.cards.length);
    }
  }, [isGameComplete]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-slate-500 text-sm font-bold flex items-center gap-1 hover:text-sky-600">
          <ArrowLeft className="w-4 h-4" /> ออกจากเกมจับคู่
        </button>
        <span className="text-xs font-extrabold text-sky-600 bg-sky-50 px-3 py-1 rounded-full">
          จับคู่แล้ว: {matchedIds.length} / {set.cards.length}
        </span>
      </div>

      {isGameComplete ? (
        <div className="bg-white p-8 rounded-3xl border border-sky-100 shadow-xl text-center space-y-4 max-w-md mx-auto">
          <Sparkles className="w-12 h-12 text-sky-500 mx-auto animate-bounce" />
          <h2 className="text-2xl font-extrabold text-slate-800">จับคู่สำเร็จทั้งหมด! 🎉</h2>
          <p className="text-slate-500 text-sm">จำนวนครั้งที่ลอง: {moves} ครั้ง</p>
          <button
            onClick={onBack}
            className="w-full py-3 rounded-2xl bg-sky-500 text-white font-extrabold shadow-md hover:bg-sky-600 transition-all text-sm"
          >
            กลับสู่คลังคำศัพท์
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cards.map((item, idx) => {
            const isMatched = matchedIds.includes(item.id);
            const isSelected = selectedFirst && selectedFirst.text === item.text && selectedFirst.type === item.type;

            let cardStyle = "bg-white border-slate-200 text-slate-700 hover:border-sky-300 shadow-sm";
            if (isMatched) {
              cardStyle = "bg-emerald-50 border-emerald-200 text-emerald-400 opacity-40 cursor-default";
            } else if (isSelected) {
              cardStyle = "bg-sky-500 border-sky-500 text-white font-bold scale-105 shadow-md";
            }

            return (
              <button
                key={idx}
                onClick={() => handleCardClick({ ...item, uniqueIndex: idx })}
                disabled={isMatched}
                className={`h-28 p-4 rounded-3xl border flex items-center justify-center text-center font-bold text-sm transition-all duration-200 ${cardStyle}`}
              >
                {item.text}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ==========================================
   7. PRESENTATION MODE (CLASS PROJECTOR VIEW)
========================================== */
function PresentationModeView({ set, onBack }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const currentCard = set.cards[currentIndex];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 text-white p-6 md:p-12 flex flex-col justify-between animate-in fade-in">
      
      {/* Presentation Top Bar */}
      <div className="flex items-center justify-between">
        <div>
          <span className="bg-pink-500/20 text-pink-300 px-3 py-1 rounded-full text-xs font-extrabold">
            โหมดฉายหน้าชั้นเรียน 📺
          </span>
          <h2 className="text-xl font-bold mt-1 text-white">{set.title}</h2>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-all"
        >
          ปิดหน้าจอ presentation
        </button>
      </div>

      {/* Main Large Card Area */}
      <div
        onClick={() => setIsFlipped(!isFlipped)}
        className="max-w-4xl w-full mx-auto h-[60vh] bg-white/10 border border-white/20 rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer shadow-2xl backdrop-blur-md select-none hover:bg-white/15 transition-all"
      >
        {!isFlipped ? (
          <div>
            <span className="text-xs font-bold text-pink-300 uppercase tracking-widest">คำศัพท์ / คำถาม</span>
            <h1 className="text-5xl md:text-7xl font-black mt-4 text-white leading-tight">{currentCard?.front}</h1>
            <p className="text-xs text-white/50 mt-8 flex items-center justify-center gap-1">
              <RotateCw className="w-4 h-4" /> คลิกเพื่อเฉลยคำตอบ
            </p>
          </div>
        ) : (
          <div>
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-widest">คำตอบ / ความหมาย</span>
            <h1 className="text-5xl md:text-7xl font-black mt-4 text-emerald-400 leading-tight">{currentCard?.back}</h1>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="max-w-xl w-full mx-auto flex items-center justify-between">
        <button
          onClick={() => {
            setIsFlipped(false);
            if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
          }}
          disabled={currentIndex === 0}
          className="px-6 py-3 rounded-2xl bg-white/10 disabled:opacity-30 hover:bg-white/20 font-bold transition-all flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" /> ก่อนหน้า
        </button>

        <span className="font-extrabold text-sm text-white/70">
          {currentIndex + 1} / {set.cards.length}
        </span>

        <button
          onClick={() => {
            setIsFlipped(false);
            if (currentIndex < set.cards.length - 1) setCurrentIndex(prev => prev + 1);
          }}
          disabled={currentIndex === set.cards.length - 1}
          className="px-6 py-3 rounded-2xl bg-pink-500 hover:bg-pink-600 font-bold transition-all flex items-center gap-2 shadow-lg shadow-pink-500/30"
        >
          ถัดไป <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

/* ==========================================
   8. CLASSROOMS VIEW (JOIN & CREATE ROOMS)
========================================== */
function ClassroomsView({ rooms, sets, role, user, userName, onSelectSet, showToast }) {
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedSetId, setSelectedSetId] = useState('');
  const [joinCode, setJoinCode] = useState('');

  // Create Room (Teacher)
  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName || !selectedSetId) return;

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      const roomsColl = collection(db, 'artifacts', appId, 'public', 'data', 'classroom_rooms');
      await addDoc(roomsColl, {
        roomName: newRoomName,
        code,
        setId: selectedSetId,
        teacherName: userName || 'คุณครู',
        teacherId: user ? user.uid : 'anon',
        studentsCount: 1,
        createdAt: Date.now()
      });
      showToast(`สร้างห้องเรียนสำเร็จ! รหัสเข้าห้อง: ${code}`);
      setNewRoomName('');
    } catch (err) {
      showToast("สร้างห้องเรียนไม่สำเร็จ", "error");
    }
  };

  // Join Room (Student)
  const handleJoinRoom = (e) => {
    e.preventDefault();
    const foundRoom = rooms.find(r => r.code === joinCode.trim().toUpperCase());
    if (foundRoom) {
      const setObj = sets.find(s => s.id === foundRoom.setId);
      if (setObj) {
        showToast(`เข้าร่วมห้องเรียน ${foundRoom.roomName} สำเร็จ!`);
        onSelectSet(setObj, 'study');
      } else {
        showToast("ไม่พบชุดคำศัพท์ในห้องเรียนนี้", "error");
      }
    } else {
      showToast("รหัสเข้าห้องเรียนไม่ถูกต้อง", "error");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-800">ระบบห้องเรียน 🏫</h2>
        <p className="text-slate-500 text-sm">จัดกิจกรรมการเรียนการสอนแบบเรียลไทม์ในชั้นเรียน</p>
      </div>

      {/* Teacher Room Creation Form */}
      {role === 'teacher' && (
        <div className="bg-white p-6 rounded-3xl border border-pink-100 shadow-sm space-y-4 max-w-xl">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <Plus className="w-5 h-5 text-pink-400" /> สร้างห้องเรียนใหม่
          </h3>
          <form onSubmit={handleCreateRoom} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">ชื่อห้องเรียน</label>
              <input
                type="text"
                required
                placeholder="เช่น ห้อง ป.4/1 วิชาภาษาอังกฤษ"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm outline-none focus:border-pink-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">เลือกชุด Flashcard ที่ใช้สอน</label>
              <select
                required
                value={selectedSetId}
                onChange={(e) => setSelectedSetId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 outline-none focus:border-pink-300"
              >
                <option value="">-- เลือกชุด Flashcard --</option>
                {sets.map(s => (
                  <option key={s.id} value={s.id}>{s.title} ({s.cards ? s.cards.length : 0} คำศัพท์)</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-pink-500 text-white font-extrabold text-sm shadow-md hover:bg-pink-600 transition-all"
            >
              เปิดห้องเรียนทันที 🚀
            </button>
          </form>
        </div>
      )}

      {/* Student Join Room Form */}
      {role === 'student' && (
        <div className="bg-white p-6 rounded-3xl border border-sky-100 shadow-sm space-y-4 max-w-xl">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <Key className="w-5 h-5 text-sky-400" /> เข้าร่วมห้องเรียนของคุณครู
          </h3>
          <form onSubmit={handleJoinRoom} className="flex gap-2">
            <input
              type="text"
              required
              placeholder="กรอกรหัสเข้าห้อง 6 หลัก"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="flex-1 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-center font-extrabold text-lg uppercase tracking-widest outline-none focus:border-sky-300"
            />
            <button
              type="submit"
              className="px-6 py-3 rounded-2xl bg-sky-400 text-white font-extrabold text-sm shadow-md hover:bg-sky-500 transition-all"
            >
              เข้าร่วม ➡️
            </button>
          </form>
        </div>
      )}

      {/* Active Rooms List */}
      <div>
        <h3 className="font-bold text-lg text-slate-800 mb-3">ห้องเรียนที่เปิดใช้งานอยู่ ({rooms.length})</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rooms.map(room => {
            const setObj = sets.find(s => s.id === room.setId);
            return (
              <div key={room.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-slate-800 text-base">{room.roomName}</h4>
                  <span className="px-3 py-1 rounded-full bg-pink-100 text-pink-600 font-black text-xs">
                    {room.code}
                  </span>
                </div>
                <p className="text-xs text-slate-400">ครูผู้สอน: {room.teacherName}</p>
                {setObj && (
                  <button
                    onClick={() => onSelectSet(setObj, 'study')}
                    className="w-full py-2 rounded-xl bg-slate-50 hover:bg-pink-50 text-slate-700 hover:text-pink-600 font-bold text-xs transition-all flex items-center justify-center gap-1"
                  >
                    <BookOpen className="w-3.5 h-3.5" /> เข้าเรียนบทเรียนนี้
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ==========================================
   9. REPORT VIEW (TEACHER ANALYTICS)
========================================== */
function ReportView({ stats, sets }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-800">รายงานผลการเรียนรู้ 📊</h2>
        <p className="text-slate-500 text-sm">ติดตามความก้าวหน้าและคะแนนแบบทดสอบของนักเรียน</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              <th className="p-4">นักเรียน</th>
              <th className="p-4">โหมดการเรียน</th>
              <th className="p-4">คะแนน</th>
              <th className="p-4">คิดเป็น %</th>
              <th className="p-4">เวลา</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {stats.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-8 text-center text-slate-400">
                  ยังไม่มีประวัติการทำแบบทดสอบ
                </td>
              </tr>
            ) : (
              stats.map((st, i) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="p-4 font-bold text-slate-800">{st.userName}</td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-600">
                      {st.mode}
                    </span>
                  </td>
                  <td className="p-4 font-extrabold text-slate-700">{st.score} / {st.total}</td>
                  <td className="p-4 font-black text-emerald-500">{st.percentage}%</td>
                  <td className="p-4 text-xs text-slate-400">
                    {new Date(st.timestamp).toLocaleDateString('th-TH')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==========================================
   10. PROFILE VIEW
========================================== */
function ProfileView({ userName, setUserName, role, setRole, user, showToast }) {
  const [nameInput, setNameInput] = useState(userName);

  const handleSave = (e) => {
    e.preventDefault();
    setUserName(nameInput);
    if (user) {
      localStorage.setItem(`name_${user.uid}`, nameInput);
    }
    showToast("บันทึกชื่อเรียบร้อยแล้ว ✨");
  };

  return (
    <div className="max-w-md mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-800">ตั้งค่าโปรไฟล์ 👤</h2>
        <p className="text-slate-500 text-sm">จัดการข้อมูลผู้ใช้งานของคุณ</p>
      </div>

      <form onSubmit={handleSave} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">ชื่อที่แสดงในระบบ</label>
          <input
            type="text"
            required
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 outline-none focus:border-pink-300"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">สิทธิ์ปัจจุบัน</label>
          <div className="p-3 bg-slate-50 rounded-2xl font-bold text-slate-700 text-sm flex justify-between items-center">
            <span>{role === 'teacher' ? 'คุณครู (Teacher)' : 'นักเรียน (Student)'}</span>
            <button
              type="button"
              onClick={() => setRole(role === 'teacher' ? 'student' : 'teacher')}
              className="text-xs text-pink-500 hover:underline font-bold"
            >
              เปลี่ยนสิทธิ์
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3 rounded-2xl bg-pink-500 text-white font-extrabold text-sm shadow-md hover:bg-pink-600 transition-all"
        >
          บันทึกข้อมูล ✨
        </button>
      </form>
    </div>
  );
}