import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { Eye, EyeOff, Plus, Edit2, Trash2, LogOut, Lock, Copy, Check, Briefcase, User, X, Search, ChevronRight, GripVertical } from 'lucide-react';

// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyD8pnFHf9blMb8NmthT2VDTOl9UWV9ixJQ",
  authDomain: "secretbox-app-fe941.firebaseapp.com",
  projectId: "secretbox-app-fe941",
  storageBucket: "secretbox-app-fe941.firebasestorage.app",
  messagingSenderId: "657392377954",
  appId: "1:657392377954:web:5d798e1fc64428973d313b"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'secretbox-app-fe941';

const App = () => {
  const [user, setUser] = useState(null);
  const [passwords, setPasswords] = useState([]);
  const [filteredPasswords, setFilteredPasswords] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  
  const [editingId, setEditingId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPasswordMap, setShowPasswordMap] = useState({});
  const [copiedField, setCopiedField] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  
  const [draggedIndex, setDraggedIndex] = useState(null);
  
  const initialFormState = {
    serviceName: '',
    category: '個人用',
    loginId: '',
    password: '',
    memo: '',
    customFields: []
  };
  const [formData, setFormData] = useState(initialFormState);
  const [isNewCategoryInput, setIsNewCategoryInput] = useState(false);

  // --- Dynamic Font & Style Injection ---
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Roboto:wght@400;500;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.innerHTML = `
      body, input, select, textarea, button {
        font-family: 'Roboto', 'Noto Sans JP', sans-serif !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
          await signInWithCustomToken(auth, __initial_auth_token);
        } catch (error) {
          if (error.code !== 'auth/custom-token-mismatch') console.error(error);
        }
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setPasswords([]);
        setSelectedItem(null);
        setIsDetailModalOpen(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const passwordsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'passwords');
    const unsubscribe = onSnapshot(passwordsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // sortOrderの昇順、無ければcreatedAtの降順
      data.sort((a, b) => {
        if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
          return a.sortOrder - b.sortOrder;
        }
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setPasswords(data);
    }, (error) => {
      console.error(error);
      showError("データの読み込みに失敗しました。");
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    let result = passwords;
    if (filterCategory !== 'all') result = result.filter(p => p.category === filterCategory);
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.serviceName.toLowerCase().includes(query) || 
        p.loginId.toLowerCase().includes(query) ||
        (p.memo && p.memo.toLowerCase().includes(query))
      );
    }
    setFilteredPasswords(result);
  }, [passwords, filterCategory, searchQuery]);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); } 
    catch (error) { showError("ログインに失敗しました。ポップアップを許可してください。"); }
  };

  const handleLogout = async () => { try { await signOut(auth); } catch (error) { console.error(error); } };

  const handleOpenModal = (passwordData = null) => {
    if (passwordData) {
      setFormData(passwordData);
      setEditingId(passwordData.id);
    } else {
      setFormData(initialFormState);
      setEditingId(null);
    }
    setIsNewCategoryInput(false);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData(initialFormState);
    setEditingId(null);
    setIsNewCategoryInput(false);
  };

  const handleOpenDetailModal = (item) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
    setShowPasswordMap({});
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedItem(null);
  };

  const handleEditFromDetail = () => {
    if (!selectedItem) return;
    setFormData({
      serviceName: selectedItem.serviceName || '',
      category: selectedItem.category || '個人用',
      loginId: selectedItem.loginId || '',
      password: selectedItem.password || '',
      memo: selectedItem.memo || '',
      customFields: selectedItem.customFields ? [...selectedItem.customFields] : [],
      sortOrder: selectedItem.sortOrder !== undefined ? selectedItem.sortOrder : passwords.length
    });
    setEditingId(selectedItem.id);
    setIsDetailModalOpen(false);
    setIsModalOpen(true);
  };

  const handleDeleteTrigger = () => {
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!user || !selectedItem) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'passwords', selectedItem.id));
      setIsDeleteConfirmOpen(false);
      setIsDetailModalOpen(false);
      setSelectedItem(null);
    } catch (error) {
      showError("削除に失敗しました。");
    }
  };

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleAddCustomField = () => setFormData(prev => ({ ...prev, customFields: [...(prev.customFields || []), { label: '', value: '', isSecret: false }] }));
  
  const handleCustomFieldChange = (index, field, value) => {
    setFormData(prev => {
      const newFields = [...(prev.customFields || [])];
      newFields[index][field] = value;
      return { ...prev, customFields: newFields };
    });
  };

  const handleRemoveCustomField = (index) => {
    setFormData(prev => {
      const newFields = [...(prev.customFields || [])];
      newFields.splice(index, 1);
      return { ...prev, customFields: newFields };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.serviceName.trim()) return showError("サービス名は必須です。");
    const passwordsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'passwords');
    const now = Date.now();
    try {
      if (editingId) {
        const updatedItem = { ...formData, updatedAt: now };
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'passwords', editingId), updatedItem);
        if (selectedItem && selectedItem.id === editingId) {
          setSelectedItem({ id: editingId, ...updatedItem });
        }
      } else {
        // 新規追加時はリストの最後に配置
        const nextOrder = passwords.length > 0 ? Math.max(...passwords.map(p => p.sortOrder || 0)) + 1 : 0;
        await addDoc(passwordsRef, { ...formData, createdAt: now, updatedAt: now, sortOrder: nextOrder });
      }
      handleCloseModal();
    } catch (error) { showError("保存に失敗しました。"); }
  };

  // --- Drag and Drop Logic ---
  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    // 現在表示されているフィルター済みの配列を元に並び替えをシミュレート
    const newFiltered = [...filteredPasswords];
    const draggedItem = newFiltered[draggedIndex];
    newFiltered.splice(draggedIndex, 1);
    newFiltered.splice(index, 0, draggedItem);
    
    setDraggedIndex(index);
    setFilteredPasswords(newFiltered);
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);
    if (!user) return;

    // 並び替えられた現在の画面表示順を元に、全体のsortOrderを確定して一括アップデート
    try {
      const batch = writeBatch(db);
      filteredPasswords.forEach((item, index) => {
        const itemRef = doc(db, 'artifacts', appId, 'users', user.uid, 'passwords', item.id);
        batch.update(itemRef, { sortOrder: index });
      });
      await batch.commit();
    } catch (error) {
      console.error(error);
      showError("並び順の保存に失敗しました。");
    }
  };

  const togglePasswordVisibility = (id) => setShowPasswordMap(prev => ({ ...prev, [id]: !prev[id] }));

  const copyToClipboard = (text, fieldId) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) { showError("コピーに失敗しました。"); }
    document.body.removeChild(textArea);
  };

  const showError = (msg) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(''), 5000);
  };

  const uniqueCategories = Array.from(new Set(passwords.map(p => p.category).filter(Boolean)));
  const allCategories = Array.from(new Set(['個人用', '業務用', ...uniqueCategories]));

  const handleCategorySelect = (e) => {
    if (e.target.value === '__NEW__') {
      setIsNewCategoryInput(true);
      setFormData(prev => ({ ...prev, category: '' }));
    } else {
      setIsNewCategoryInput(false);
      handleChange(e);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6"><Lock size={32} /></div>
          <h1 className="text-[32px] font-bold text-gray-900 mb-2 leading-tight">SecretBox</h1>
          <p className="text-[18px] font-medium text-gray-500 mb-8">安全にIDとパスワードを保管・共有</p>
          <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-3.5 rounded-xl text-[14px] font-medium transition-colors shadow-sm">
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
              <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
              </g>
            </svg>
            Googleでログイン
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-24">
      {errorMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 text-[14px] font-medium">
          <span>{errorMessage}</span><button onClick={() => setErrorMessage('')}><X size={16} /></button>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600">
            <Lock size={24} />
            <h1 className="text-[20px] font-bold text-gray-900 tracking-tight">SecretBox</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} alt="user" className="w-8 h-8 rounded-full border" />
              <span className="hidden md:inline text-[14px] font-medium text-gray-600">{user.email}</span>
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-600 p-2 transition-colors"><LogOut size={20} /></button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Search & Category Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto" style={{ scrollbarWidth: 'none' }}>
            <button onClick={() => setFilterCategory('all')} className={`flex-shrink-0 px-4 py-2 rounded-lg text-[14px] font-medium transition-all ${filterCategory === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>すべて</button>
            {allCategories.map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)} className={`flex-shrink-0 px-4 py-2 rounded-lg text-[14px] font-medium transition-all ${filterCategory === cat ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{cat}</button>
            ))}
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" placeholder="サービス名やIDで検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 text-[14px] font-medium rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white" />
          </div>
        </div>

        {/* Compact Password List with Drag & Drop */}
        {filteredPasswords.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
            <Lock className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-400 text-[16px] font-medium">登録されているパスワードはありません</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100">
            {filteredPasswords.map((item, index) => (
              <div 
                key={item.id} 
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`px-3 py-1.5 flex items-center gap-2 hover:bg-blue-50/20 active:bg-blue-50/40 transition-colors bg-white ${draggedIndex === index ? 'opacity-40 bg-gray-50' : ''}`}
              >
                {/* Drag Handle Icon */}
                <div className="text-gray-300 hover:text-gray-500 cursor-get cursor-grab active:cursor-grabbing p-1">
                  <GripVertical size={16} />
                </div>

                <div 
                  className="flex items-center justify-between w-full gap-4 cursor-pointer min-w-0"
                  onClick={() => handleOpenDetailModal(item)}
                >
                  {/* Service Name (55%) */}
                  <div className="w-[55%] min-w-0">
                    <div className="text-[16px] font-medium text-gray-900 truncate">
                      {item.serviceName}
                    </div>
                  </div>
                  {/* ID (45%) */}
                  <div className="w-[45%] min-w-0 text-right flex items-center justify-end gap-1.5">
                    <div className="text-[14px] font-medium text-gray-400 truncate max-w-[90%]">
                      {item.loginId || '未設定'}
                    </div>
                    <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Float Add Button */}
      <button onClick={() => handleOpenModal()} className="fixed bottom-6 right-6 bg-blue-600 text-white w-14 h-14 rounded-full shadow-lg hover:bg-blue-700 hover:scale-105 active:scale-95 flex items-center justify-center z-20 transition-all"><Plus size={28} /></button>

      {/* --- Detail Popup Modal --- */}
      {isDetailModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
              <div className="flex items-center gap-2 min-w-0 pr-4">
                <h2 className="text-[24px] font-bold text-gray-900 truncate">{selectedItem.serviceName}</h2>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100 font-medium flex-shrink-0">{selectedItem.category}</span>
              </div>
              <button onClick={handleCloseDetailModal} className="text-gray-400 hover:text-gray-600 transition-colors p-1"><X size={24} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
              <div className="space-y-1.5">
                <label className="text-[14px] font-medium text-gray-400">ID / メールアドレス</label>
                <div className="flex items-center justify-between bg-gray-50 px-3 py-2.5 rounded-xl border border-gray-100">
                  <span className="text-[16px] font-medium text-gray-800 truncate select-all pr-2">{selectedItem.loginId || '未設定'}</span>
                  {selectedItem.loginId && (
                    <button onClick={() => copyToClipboard(selectedItem.loginId, `detail-id`)} className="text-gray-400 hover:text-blue-600 p-1.5 hover:bg-white rounded-lg transition-all">
                      {copiedField === `detail-id` ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[14px] font-medium text-gray-400">パスワード</label>
                <div className="flex items-center justify-between bg-gray-50 px-3 py-2.5 rounded-xl border border-gray-100">
                  <input 
                    type={showPasswordMap['detail-pass'] ? "text" : "password"} 
                    value={selectedItem.password || ''} 
                    readOnly 
                    className="bg-transparent text-[16px] font-medium text-gray-800 font-mono outline-none w-full" 
                  />
                  {selectedItem.password && (
                    <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
                      <button onClick={() => togglePasswordVisibility('detail-pass')} className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-white rounded-lg transition-all">
                        {showPasswordMap['detail-pass'] ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button onClick={() => copyToClipboard(selectedItem.password, `detail-pass`)} className="text-gray-400 hover:text-blue-600 p-1.5 hover:bg-white rounded-lg transition-all">
                        {copiedField === `detail-pass` ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {selectedItem.customFields && selectedItem.customFields.length > 0 && (
                <div className="space-y-4 pt-3 border-t border-gray-100">
                  <h3 className="text-[14px] font-bold text-gray-800">追加情報</h3>
                  <div className="grid grid-cols-1 gap-3.5">
                    {selectedItem.customFields.map((field, idx) => (
                      <div key={idx} className="space-y-1">
                        <span className="text-[14px] font-medium text-gray-400">{field.label || 'カスタム項目'}</span>
                        <div className="flex items-center justify-between bg-gray-50 px-3 py-2.5 rounded-xl border border-gray-100">
                          {field.isSecret ? (
                            <input 
                              type={showPasswordMap[`detail-custom-${idx}`] ? "text" : "password"} 
                              value={field.value || ''} 
                              readOnly 
                              className="bg-transparent text-[16px] font-medium text-gray-800 font-mono outline-none w-full" 
                            />
                          ) : (
                            <span className="text-[16px] font-medium text-gray-800 truncate select-all pr-2">{field.value || '-'}</span>
                          )}
                          {field.value && (
                            <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
                              {field.isSecret && (
                                <button onClick={() => togglePasswordVisibility(`detail-custom-${idx}`)} className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-white rounded-lg transition-all">
                                  {showPasswordMap[`detail-custom-${idx}`] ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                              )}
                              <button onClick={() => copyToClipboard(field.value, `detail-custom-${idx}`)} className="text-gray-400 hover:text-blue-600 p-1.5 hover:bg-white rounded-lg transition-all">
                                {copiedField === `detail-custom-${idx}` ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedItem.memo && (
                <div className="space-y-1.5 pt-3 border-t border-gray-100">
                  <label className="text-[14px] font-medium text-gray-400">メモ</label>
                  <p className="text-[14px] font-medium text-gray-700 bg-yellow-50/50 p-3.5 rounded-xl border border-yellow-100 whitespace-pre-wrap leading-relaxed">{selectedItem.memo}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex justify-between items-center">
              <button 
                onClick={handleDeleteTrigger} 
                className="flex items-center gap-1.5 px-4 py-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl text-[14px] font-medium transition-colors"
              >
                <Trash2 size={16} />削除
              </button>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleCloseDetailModal} 
                  className="px-4 py-2 text-[14px] font-medium text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
                >
                  閉じる
                </button>
                <button 
                  onClick={handleEditFromDetail} 
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-[14px] font-medium transition-all shadow-sm shadow-blue-100"
                >
                  <Edit2 size={16} />編集する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Safe Custom Delete Confirmation Overlaid Modal --- */}
      {isDeleteConfirmOpen && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-[20px] font-bold text-gray-900 leading-tight">本当に削除しますか？</h3>
            <p className="text-[14px] font-medium text-gray-500 leading-relaxed">
              「{selectedItem.serviceName}」に関する保存情報を永久に削除します。この操作は取り消せません。
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button 
                onClick={() => setIsDeleteConfirmOpen(false)} 
                className="px-4 py-2 text-[14px] font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button 
                onClick={handleConfirmDelete} 
                className="px-4 py-2 text-[14px] font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm"
              >
                完全に削除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Add / Edit Form Modal --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-[20px] font-bold text-gray-900">{editingId ? '情報の編集' : '新規情報の登録'}</h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={24} /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <form id="password-form" onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-[14px] font-medium text-gray-700 mb-1">サービス名 *</label>
                  <input type="text" name="serviceName" value={formData.serviceName} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-[14px] font-medium transition-all" />
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-gray-700 mb-1">カテゴリー</label>
                  {isNewCategoryInput ? (
                    <div className="flex gap-2">
                      <input type="text" value={formData.category} onChange={handleChange} name="category" placeholder="新しいカテゴリー" className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-[14px] font-medium" autoFocus />
                      <button type="button" onClick={() => { setIsNewCategoryInput(false); setFormData(prev => ({...prev, category: '個人用'})) }} className="text-[12px] font-medium text-gray-400 hover:text-gray-600">キャンセル</button>
                    </div>
                  ) : (
                    <select name="category" value={formData.category} onChange={handleCategorySelect} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[14px] font-medium bg-white">
                      {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      <option disabled>──────────</option>
                      <option value="__NEW__">＋ 新規追加...</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-gray-700 mb-1">ID / メールアドレス</label>
                  <input type="text" name="loginId" value={formData.loginId} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[14px] font-medium" />
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-gray-700 mb-1">パスワード</label>
                  <div className="relative">
                    <input type={showPasswordMap['form'] ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} className="w-full pl-3 pr-10 py-2 border border-gray-200 rounded-xl text-[14px] font-medium font-mono" />
                    <button type="button" onClick={() => togglePasswordVisibility('form')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1">{showPasswordMap['form'] ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <label className="text-[14px] font-bold text-gray-800">追加項目</label>
                    <button type="button" onClick={handleAddCustomField} className="text-[12px] font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1">＋ 項目を追加</button>
                  </div>
                  {formData.customFields && formData.customFields.map((field, index) => (
                    <div key={index} className="flex flex-col gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200 relative">
                      <div className="flex items-center gap-2">
                        <input type="text" placeholder="項目名 (例: 秘密の質問)" value={field.label} onChange={(e) => handleCustomFieldChange(index, 'label', e.target.value)} className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-[13px] font-medium bg-white" />
                        <label className="flex items-center text-[12px] font-medium text-gray-500 gap-1 select-none">
                          <input type="checkbox" checked={field.isSecret || false} onChange={(e) => handleCustomFieldChange(index, 'isSecret', e.target.checked)} className="rounded text-blue-600 focus:ring-blue-100" />
                          隠す
                        </label>
                        <button type="button" onClick={() => handleRemoveCustomField(index)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                      </div>
                      <div className="relative">
                        <input type={field.isSecret && !showPasswordMap[`form-custom-${index}`] ? "password" : "text"} placeholder="登録する値" value={field.value} onChange={(e) => handleCustomFieldChange(index, 'value', e.target.value)} className={`w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-[13px] font-medium bg-white ${field.isSecret ? 'font-mono' : ''}`} />
                        {field.isSecret && (
                          <button type="button" onClick={() => togglePasswordVisibility(`form-custom-${index}`)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                            {showPasswordMap[`form-custom-${index}`] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-[14px] font-medium text-gray-700 mb-1">メモ</label>
                  <textarea name="memo" value={formData.memo} onChange={handleChange} rows="2" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[14px] font-medium resize-none"></textarea>
                </div>
              </form>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button type="button" onClick={handleCloseModal} className="px-4 py-2 text-[14px] font-medium text-gray-600 hover:bg-gray-100 rounded-xl">キャンセル</button>
              <button type="submit" form="password-form" className="px-5 py-2 text-[14px] font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm">保存する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;