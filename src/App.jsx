import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Eye, EyeOff, Plus, Edit2, Trash2, LogOut, Lock, Copy, Check, Briefcase, User, X, Search, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [editingId, setEditingId] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPasswordMap, setShowPasswordMap] = useState({});
  const [copiedField, setCopiedField] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  
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
  const [expandedIds, setExpandedIds] = useState({});

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
      if (!currentUser) setPasswords([]);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const passwordsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'passwords');
    const unsubscribe = onSnapshot(passwordsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
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

  const toggleExpand = (id) => setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.serviceName.trim()) return showError("サービス名は必須です。");
    const passwordsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'passwords');
    const now = Date.now();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'passwords', editingId), { ...formData, updatedAt: now });
      } else {
        await addDoc(passwordsRef, { ...formData, createdAt: now, updatedAt: now });
      }
      handleCloseModal();
    } catch (error) { showError("保存に失敗しました。"); }
  };

  const handleDelete = async (id) => {
    if (!user) return;
    if (window.confirm("削除してよろしいですか？")) {
       try { await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'passwords', id)); } 
       catch (error) { showError("削除に失敗しました。"); }
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
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6"><Lock size={32} /></div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">SecretBox</h1>
          <p className="text-gray-500 mb-8">安全にIDとパスワードを保管・共有</p>
          <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-3 rounded-lg font-medium transition-colors shadow-sm">
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
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800 pb-20 md:pb-8">
      {errorMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2">
          <span>{errorMessage}</span><button onClick={() => setErrorMessage('')}><X size={16} /></button>
        </div>
      )}

      <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600"><Lock size={24} /><h1 className="text-xl font-bold hidden sm:block">SecretBox</h1></div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} alt="user" className="w-8 h-8 rounded-full border" />
              <span className="hidden md:inline">{user.email}</span>
            </div>
            <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 p-2"><LogOut size={20} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto" style={{ scrollbarWidth: 'none' }}>
            <button onClick={() => setFilterCategory('all')} className={`flex-shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterCategory === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-white border text-gray-600'}`}>すべて</button>
            {allCategories.map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)} className={`flex-shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterCategory === cat ? 'bg-blue-100 text-blue-700' : 'bg-white border text-gray-600'}`}>{cat}</button>
            ))}
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" placeholder="検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>

        {filteredPasswords.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300"><Lock className="mx-auto text-gray-300 mb-4" size={48} /><p className="text-gray-500 text-sm">登録情報はありません。</p></div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredPasswords.map(item => (
              <div key={item.id} className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="px-3 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2 cursor-pointer hover:bg-gray-50" onClick={() => toggleExpand(item.id)}>
                  <div className="flex items-center gap-3 flex-1 overflow-hidden">
                    <div className="flex items-center gap-2 w-1/3 min-w-[140px] max-w-[200px]">
                      <h3 className="font-semibold text-sm truncate">{item.serviceName}</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 border whitespace-nowrap">{item.category}</span>
                    </div>
                    <div className="hidden md:flex flex-1 items-center gap-3 text-xs text-gray-500">
                       <span className="truncate w-1/2">{item.loginId || '-'}</span>
                       <span className="w-1/2">{item.password ? '••••••••' : '-'}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between md:justify-end gap-2 md:w-28">
                    <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleOpenModal(item)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Edit2 size={14}/></button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 size={14}/></button>
                    </div>
                    <div className="text-gray-400 ml-1">{expandedIds[item.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                  </div>
                </div>
                
                {expandedIds[item.id] && (
                  <div className="p-3 border-t bg-gray-50/50 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-gray-500 font-semibold mb-0.5 block">ID / メールアドレス</label>
                        <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded border">
                          <span className="text-sm font-mono truncate mr-2">{item.loginId || '-'}</span>
                          {item.loginId && <button onClick={() => copyToClipboard(item.loginId, `id-${item.id}`)} className="text-gray-400 hover:text-blue-600 p-1">{copiedField === `id-${item.id}` ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}</button>}
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 font-semibold mb-0.5 block">パスワード</label>
                        <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded border">
                          <input type={showPasswordMap[item.id] ? "text" : "password"} value={item.password || ''} readOnly className="w-full bg-transparent text-sm font-mono outline-none" />
                          {item.password && (
                            <div className="flex items-center border-l pl-1 gap-0.5">
                              <button onClick={() => togglePasswordVisibility(item.id)} className="text-gray-400 hover:text-gray-600 p-1">{showPasswordMap[item.id] ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
                              <button onClick={() => copyToClipboard(item.password, `pass-${item.id}`)} className="text-gray-400 hover:text-blue-600 p-1">{copiedField === `pass-${item.id}` ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {item.customFields && item.customFields.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {item.customFields.map((field, idx) => (
                          <div key={idx}>
                            <label className="text-[11px] text-gray-500 font-semibold mb-0.5 block">{field.label || 'カスタム項目'}</label>
                            <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded border">
                              {field.isSecret ? (
                                <input type={showPasswordMap[`${item.id}-custom-${idx}`] ? "text" : "password"} value={field.value || ''} readOnly className="flex-1 bg-transparent text-sm font-mono outline-none mr-2" />
                              ) : <span className="text-sm truncate mr-2">{field.value || '-'}</span>}
                              {field.value && (
                                <div className="flex items-center border-l pl-1 gap-0.5">
                                  {field.isSecret && <button onClick={() => togglePasswordVisibility(`${item.id}-custom-${idx}`)} className="text-gray-400 hover:text-gray-600 p-1">{showPasswordMap[`${item.id}-custom-${idx}`] ? <EyeOff size={14}/> : <Eye size={14}/>}</button>}
                                  <button onClick={() => copyToClipboard(field.value, `custom-${item.id}-${idx}`)} className="text-gray-400 hover:text-blue-600 p-1">{copiedField === `custom-${item.id}-${idx}` ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}</button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {item.memo && <div><label className="text-[11px] text-gray-500 font-semibold mb-0.5 block">メモ</label><p className="text-xs bg-yellow-50 p-2 rounded border whitespace-pre-wrap">{item.memo}</p></div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <button onClick={() => handleOpenModal()} className="fixed bottom-6 right-6 bg-blue-600 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-20"><Plus size={28} /></button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold">{editingId ? '情報の編集' : '新規追加'}</h2>
              <button onClick={handleCloseModal} className="text-gray-400"><X size={24} /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form id="password-form" onSubmit={handleSave} className="space-y-4">
                <div><label className="block text-sm font-medium mb-1">サービス名 *</label><input type="text" name="serviceName" value={formData.serviceName} onChange={handleChange} required className="w-full px-3 py-2 border rounded focus:ring-1 outline-none text-sm" /></div>
                <div>
                  <label className="block text-sm font-medium mb-1">カテゴリー</label>
                  {isNewCategoryInput ? (
                    <div className="flex gap-2"><input type="text" value={formData.category} onChange={handleChange} name="category" placeholder="新しいカテゴリー" className="flex-1 px-3 py-2 border rounded text-sm" autoFocus /><button type="button" onClick={() => { setIsNewCategoryInput(false); setFormData(prev => ({...prev, category: '個人用'})) }} className="text-xs text-gray-500">キャンセル</button></div>
                  ) : (
                    <select name="category" value={formData.category} onChange={handleCategorySelect} className="w-full px-3 py-2 border rounded text-sm">
                      {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      <option disabled>──────────</option>
                      <option value="__NEW__">＋ 新規追加...</option>
                    </select>
                  )}
                </div>
                <div><label className="block text-sm font-medium mb-1">ID / メール</label><input type="text" name="loginId" value={formData.loginId} onChange={handleChange} className="w-full px-3 py-2 border rounded text-sm font-mono" /></div>
                <div>
                  <label className="block text-sm font-medium mb-1">パスワード</label>
                  <div className="relative">
                    <input type={showPasswordMap['form'] ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} className="w-full pl-3 pr-10 py-2 border rounded text-sm font-mono" />
                    <button type="button" onClick={() => togglePasswordVisibility('form')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 p-1">{showPasswordMap['form'] ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </div>
                </div>
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex justify-between items-center"><label className="text-sm font-medium">追加項目</label><button type="button" onClick={handleAddCustomField} className="text-xs text-blue-600 flex items-center"><Plus size={14} />追加</button></div>
                  {formData.customFields && formData.customFields.map((field, index) => (
                    <div key={index} className="flex flex-col gap-2 bg-gray-50 p-2.5 rounded border">
                      <div className="flex items-center gap-2">
                        <input type="text" placeholder="項目名" value={field.label} onChange={(e) => handleCustomFieldChange(index, 'label', e.target.value)} className="flex-1 px-2 py-1.5 border rounded text-sm" />
                        <label className="flex items-center text-xs gap-1"><input type="checkbox" checked={field.isSecret || false} onChange={(e) => handleCustomFieldChange(index, 'isSecret', e.target.checked)} />隠す</label>
                        <button type="button" onClick={() => handleRemoveCustomField(index)} className="text-red-400"><Trash2 size={16}/></button>
                      </div>
                      <div className="relative">
                        <input type={field.isSecret && !showPasswordMap[`form-custom-${index}`] ? "password" : "text"} placeholder="値" value={field.value} onChange={(e) => handleCustomFieldChange(index, 'value', e.target.value)} className={`w-full px-2 py-1.5 border rounded text-sm ${field.isSecret ? 'font-mono' : ''}`} />
                        {field.isSecret && <button type="button" onClick={() => togglePasswordVisibility(`form-custom-${index}`)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">{showPasswordMap[`form-custom-${index}`] ? <EyeOff size={14} /> : <Eye size={14} />}</button>}
                      </div>
                    </div>
                  ))}
                </div>
                <div><label className="block text-sm font-medium mb-1">メモ</label><textarea name="memo" value={formData.memo} onChange={handleChange} rows="2" className="w-full px-3 py-2 border rounded text-sm resize-none"></textarea></div>
              </form>
            </div>
            <div className="px-5 py-3 border-t bg-gray-50 flex justify-end gap-3">
              <button type="button" onClick={handleCloseModal} className="px-4 py-1.5 text-sm text-gray-600">キャンセル</button>
              <button type="submit" form="password-form" className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded">保存する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;