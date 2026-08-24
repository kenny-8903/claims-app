import { useRef, useState } from 'react'
import './App.css'
import { processReceiptOCR } from './services/ocrService'

/* ===== SVG 線條圖示（無 Emoji） ===== */
const SvgIcon = ({ size = 16, children, className = '' }) => (
  <svg
    className={`icon ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

const IconWallet = (p) => (
  <SvgIcon {...p}>
    <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
    <polyline points="16 5 16 7 8 7 8 5" />
    <path d="M16 13h.01" />
  </SvgIcon>
)

const IconFile = (p) => (
  <SvgIcon {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </SvgIcon>
)

const IconInbox = (p) => (
  <SvgIcon {...p}>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </SvgIcon>
)

const IconUsers = (p) => (
  <SvgIcon {...p}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </SvgIcon>
)

const IconShield = (p) => (
  <SvgIcon {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </SvgIcon>
)

const IconUpload = (p) => (
  <SvgIcon {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </SvgIcon>
)

const IconCheck = (p) => (
  <SvgIcon {...p}>
    <polyline points="20 6 9 17 4 12" />
  </SvgIcon>
)

const IconClose = (p) => (
  <SvgIcon {...p}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </SvgIcon>
)

const IconArrow = (p) => (
  <SvgIcon {...p}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </SvgIcon>
)

const IconDollar = (p) => (
  <SvgIcon {...p}>
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </SvgIcon>
)

const IconHistory = (p) => (
  <SvgIcon {...p}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </SvgIcon>
)

/* ===== 靜態資料 ===== */
const EXPENSE_CATEGORIES = ['交通費', '辦公雜費', '餐飲應酬', '緊急採購']

/* 測試帳號（登入用，密碼皆為 123456） */
const TEST_ACCOUNTS = [
  {
    id: 't1',
    username: 'Testing1',
    password: '123456',
    name: 'Testing1',
    initials: 'T1',
    dept: 'Operations',
    accessLevel: 1,
    roleLabel: 'Operations Staff',
    isLevel1: false,
    isLevel2: false,
    isLevel3: false,
    desc: 'Operations Staff：僅可建立與檢視自己的申請',
  },
  {
    id: 't2',
    username: 'Testing2',
    password: '123456',
    name: 'Testing2',
    initials: 'T2',
    dept: 'General Management',
    accessLevel: 2,
    roleLabel: 'GM (General Manager)',
    isLevel1: true,
    isLevel2: false,
    isLevel3: false,
    desc: 'General Manager (GM)：一級審批人（第 1 層審批）',
  },
  {
    id: 't3',
    username: 'Testing3',
    password: '123456',
    name: 'Testing3',
    initials: 'T3',
    dept: 'Executive',
    accessLevel: 3,
    roleLabel: 'CEO',
    isLevel1: false,
    isLevel2: true,
    isLevel3: false,
    desc: 'CEO：二級高階審批人（第 2 層審批）',
  },
  {
    id: 't4',
    username: 'Testing4',
    password: '123456',
    name: 'Testing4',
    initials: 'T4',
    dept: 'Finance & Admin',
    accessLevel: 4,
    roleLabel: 'Finance & Admin',
    isLevel1: false,
    isLevel2: false,
    isLevel3: true,
    desc: 'Finance & Admin：終極審批/放款人（最終批核）',
  },
]

/* 權限層級描述 */
const LEVEL_CONFIG = {
  1: { label: 'Level 1', role: 'Operations Staff', sub: 'Applicant' },
  2: { label: 'Level 2', role: 'General Manager', sub: 'GM / 1st Approver' },
  3: { label: 'Level 3', role: 'CEO', sub: '2nd Senior Approver' },
  4: { label: 'Level 4', role: 'Finance & Admin', sub: 'Final Approver' },
}

/* 動態金額分流門檻：金額 >= $10,000 需加經 CEO（第 2 層）審批 */
const ROUTING_THRESHOLD = 10000

/* 登入持久化 key */
const AUTH_STORAGE_KEY = 'csg_auth_user'

const MENU_ITEMS = [
  {
    id: 'new-claim',
    label: '填寫報銷單',
    sub: 'New Claim',
    icon: IconWallet,
    minLevel: 1,
  },
  {
    id: 'my-claims',
    label: '我的申請紀錄',
    sub: 'My Claims',
    icon: IconHistory,
    minLevel: 1,
  },
  {
    id: 'pending',
    label: '待我審批',
    sub: 'Pending Approvals',
    icon: IconInbox,
    minLevel: 2,
  },
  {
    id: 'user-mgmt',
    label: '權限管理',
    sub: 'User & Role Management',
    icon: IconUsers,
    minLevel: 4,
  },
]

/* 單據狀態機（四層角色・動態金額分流） */
const STATUS_CONFIG = {
  pending_1st: {
    label: '待 GM 審批',
    en: 'Pending 1st Approval (GM)',
    className: 'status-badge--pending-1st',
  },
  pending_2nd: {
    label: '待 CEO 審批',
    en: 'Pending 2nd Approval (CEO)',
    className: 'status-badge--pending-2nd',
  },
  pending_3rd: {
    label: '待財務最終批核',
    en: 'Pending Final Approval (Finance)',
    className: 'status-badge--pending-3rd',
  },
  approved: {
    label: '已核准放款',
    en: 'Fully Approved & Disbursed',
    className: 'status-badge--approved',
  },
  rejected: {
    label: '已被駁回',
    en: 'Rejected / Pending Resubmission',
    className: 'status-badge--rejected',
  },
}

/* 預置員工資料（權限管理用） */
const INITIAL_EMPLOYEES = [
  { id: 'emp1', name: 'Testing1', initials: 'T1', dept: 'Operations', accessLevel: 1, isLevel1: false, isLevel2: false, isLevel3: false },
  { id: 'emp2', name: 'Testing2', initials: 'T2', dept: 'General Management', accessLevel: 2, isLevel1: true, isLevel2: false, isLevel3: false },
  { id: 'emp3', name: 'Testing3', initials: 'T3', dept: 'Executive', accessLevel: 3, isLevel1: false, isLevel2: true, isLevel3: false },
  { id: 'emp4', name: 'Testing4', initials: 'T4', dept: 'Finance & Admin', accessLevel: 4, isLevel1: false, isLevel2: false, isLevel3: true },
  { id: 'emp5', name: 'Sarah Wong', initials: 'SW', dept: 'Finance', accessLevel: 4, isLevel1: false, isLevel2: false, isLevel3: true },
  { id: 'emp6', name: 'Michael Chan', initials: 'MC', dept: 'Operations', accessLevel: 2, isLevel1: true, isLevel2: false, isLevel3: false },
  { id: 'emp7', name: 'Grace Leung', initials: 'GL', dept: 'HR', accessLevel: 1, isLevel1: false, isLevel2: false, isLevel3: false },
]

/* 預置單據（Sample：涵蓋不同金額、審批階段與駁回狀態） */
const INITIAL_CLAIMS = [
  // CL-2026-001：低於門檻（< $10,000），待 GM 審核
  { id: 'CL-2026-001', applicant: 'Testing1', applicantInitials: 'T1', department: 'Operations', category: '交通費', amount: 3500, date: '2026-08-14', remark: '拜訪客戶往返之的士費用', receipts: ['taxi-receipt-001.pdf'], status: 'pending_1st' },
  // CL-2026-002：達門檻（>= $10,000），待 GM 審核
  { id: 'CL-2026-002', applicant: 'Testing1', applicantInitials: 'T1', department: 'Operations', category: '緊急採購', amount: 18000, date: '2026-08-15', remark: '緊急採購辦公室設備（高金額）', receipts: ['quotation-002.pdf', 'invoice-002.pdf'], status: 'pending_1st' },
  // CL-2026-003：已被 GM 駁回，等待重新編輯 / 補交文件
  { id: 'CL-2026-003', applicant: 'Testing1', applicantInitials: 'T1', department: 'Operations', category: '餐飲應酬', amount: 2500, date: '2026-08-16', remark: '與供應商聚餐商討合作細節', receipts: ['meal-receipt-003.jpg'], status: 'rejected', rejectionReason: '請補上正本收據及發票', rejectedBy: 'Testing2（GM (General Manager)）', rejectedAt: '2026-08-17T09:30:00' },
  // CL-2026-004：達門檻（>= $10,000），GM 已批，待 CEO 審核
  { id: 'CL-2026-004', applicant: 'Testing1', applicantInitials: 'T1', department: 'Operations', category: '辦公雜費', amount: 12000, date: '2026-08-18', remark: '年度辦公室文具及打印耗材', receipts: ['supplier-invoice-004.pdf'], status: 'pending_2nd' },
]

function App() {
  /* 登入狀態：從 localStorage 讀取，未登入為 null */
  const [authUserKey, setAuthUserKey] = useState(() => {
    try {
      return localStorage.getItem(AUTH_STORAGE_KEY)
    } catch {
      return null
    }
  })
  const [activeModule, setActiveModule] = useState('new-claim')
  const [department, setDepartment] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState('')
  const [remark, setRemark] = useState('')
  const [receipts, setReceipts] = useState([])
  const [claims, setClaims] = useState(INITIAL_CLAIMS)
  const [employees, setEmployees] = useState(INITIAL_EMPLOYEES)
  const [actionMessage, setActionMessage] = useState('')
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [editingClaimId, setEditingClaimId] = useState(null)
  const [rejectTargetId, setRejectTargetId] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectError, setRejectError] = useState('')
  const fileInputRef = useRef(null)
  const [ocrStatus, setOcrStatus] = useState(null) // null | 'loading' | 'done' | 'error'
  const [ocrResult, setOcrResult] = useState(null)
  const [ocrFileName, setOcrFileName] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const amountNum = parseFloat(amount) || 0
  const currentUser = TEST_ACCOUNTS.find((a) => a.id === authUserKey)
  const currentLevel = currentUser ? LEVEL_CONFIG[currentUser.accessLevel] : null

  /* 動態計算審批路徑（依金額分流：低於門檻跳過 CEO） */
  const approvalRoute = () => {
    if (!amount || amountNum <= 0) return []
    const steps = [
      { id: 'l1', name: '第 1 層審批：GM', code: '1ST', icon: IconUsers },
    ]
    if (amountNum >= ROUTING_THRESHOLD) {
      steps.push({ id: 'l2', name: '第 2 層審批：CEO', code: '2ND', icon: IconShield })
    }
    steps.push({ id: 'l3', name: '最終批核：Finance & Admin', code: 'FINAL', icon: IconDollar })
    return steps
  }

  /* ===== 登入（帳號/密碼驗證）/ 登出 ===== */
  const handleLogin = (username, password) => {
    const account = TEST_ACCOUNTS.find(
      (a) => a.username === username.trim() && a.password === password,
    )
    if (!account) {
      setLoginError('帳號或密碼不正確')
      return
    }
    setLoginError('')
    setAuthUserKey(account.id)
    setActiveModule('new-claim')
    setActionMessage('')
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, account.id)
    } catch {
      /* localStorage 不可用時忽略 */
    }
  }

  const handleLoginSubmit = (e) => {
    e.preventDefault()
    handleLogin(loginUsername, loginPassword)
  }

  const fillDemoAccount = (account) => {
    setLoginUsername(account.username)
    setLoginPassword(account.password)
    setLoginError('')
  }

  const handleLogout = () => {
    setAuthUserKey(null)
    setActiveModule('new-claim')
    setActionMessage('')
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    } catch {
      /* localStorage 不可用時忽略 */
    }
  }

  const handleModuleClick = (item) => {
    setActiveModule(item.id)
    setEditingClaimId(null)
    setActionMessage('')
  }

  /* ===== 申請人動作：載入範例 / 清除 / 儲存草稿 / 遞交 ===== */
  const loadExample = () => {
    setDepartment(currentUser.dept)
    setCategory('交通費')
    setAmount('4500')
    setExpenseDate('2026-08-12')
    setRemark('出差拜訪客戶往返之交通費用，共 3 程。')
    setReceipts(['receipt.pdf'])
    setActionMessage('')
  }

  const clearForm = () => {
    setDepartment(currentUser.dept)
    setCategory('')
    setAmount('')
    setExpenseDate('')
    setRemark('')
    setReceipts([])
    setEditingClaimId(null)
    setOcrStatus(null)
    setOcrResult(null)
    setOcrFileName('')
    setDragOver(false)
    setActionMessage('')
  }

  const removeReceipt = (fileName) => {
    setReceipts((prev) => prev.filter((f) => f !== fileName))
  }

  /* ===== PaddleOCR v4 分析：自動帶入日期與金額 ===== */
  const analyzeReceipt = async (file) => {
    setOcrStatus('loading')
    setOcrFileName(file.name)
    setOcrResult(null)
    try {
      const result = await processReceiptOCR(file)
      setOcrResult(result)
      setOcrStatus('done')
      setExpenseDate(result.extractedDate)
      setAmount(String(result.extractedAmount))
      setActionMessage(`已由 OCR 自動帶入，可手動修正。`)
    } catch (err) {
      setOcrStatus('error')
      setActionMessage(`OCR / AI 分析失敗：${err.message}`)
    }
  }

  /* 追加 / 重新上傳單據檔案（僅記錄檔名，實際後端上傳留待串接） */
  const appendFiles = (files) => {
    if (!files || files.length === 0) return null
    setReceipts((prev) => {
      const existing = new Set(prev)
      const names = Array.from(files).map((f) => f.name)
      return [...prev, ...names.filter((n) => !existing.has(n))]
    })
    setActionMessage(`已追加 ${files.length} 個檔案。`)
    // 對該批第一張圖片執行 PaddleOCR 辨識
    const imageFile = Array.from(files).find((f) => f.type && f.type.startsWith('image/'))
    if (imageFile) {
      analyzeReceipt(imageFile)
    }
    return imageFile
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    appendFiles(files)
    e.target.value = ''
  }

  /* 拖拽上傳 */
  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length === 0) return
    appendFiles(files)
  }

  /* 從「我的申請紀錄」重新編輯被駁回的單據（補交文件） */
  const startResubmit = (claim) => {
    setEditingClaimId(claim.id)
    setDepartment(claim.department || currentUser.dept)
    setCategory(claim.category || '')
    setAmount(String(claim.amount ?? ''))
    setExpenseDate(claim.date || '')
    setRemark(claim.remark || '')
    setReceipts(claim.receipts || [])
    setOcrStatus(null)
    setOcrResult(null)
    setOcrFileName('')
    setDragOver(false)
    setActiveModule('new-claim')
    setActionMessage(`正在重新編輯 ${claim.id}：修改內容並補交文件後，按「重新提交」即可再次送審。`)
  }

  const saveDraft = () => {
    setActionMessage('草稿已儲存（僅做示範，尚未寫入後端）。')
  }

  const submitForm = () => {
    if (!category || !amount || !expenseDate) {
      setActionMessage('請先填寫費用類別、金額與單據日期再遞交申請。')
      return
    }

    // 重新提交 / 補交文件模式：更新原單據，狀態重置為待 GM 審批
    if (editingClaimId) {
      setClaims((prev) =>
        prev.map((c) =>
          c.id === editingClaimId
            ? {
                ...c,
                department,
                category,
                amount: amountNum,
                date: expenseDate,
                remark,
                receipts: [...receipts],
                status: 'pending_1st',
                rejectionReason: null,
                rejectedBy: null,
                rejectedAt: null,
                resubmittedCount: (c.resubmittedCount || 0) + 1,
              }
            : c,
        ),
      )
      setActionMessage(`單據 ${editingClaimId} 已重新提交，狀態重置為「待 GM 審批」，重新進入審批流程。`)
      clearForm()
      return
    }

    const newClaim = {
      id: `CL-2026-${String(claims.length + 5).padStart(3, '0')}`,
      applicant: currentUser.name,
      applicantInitials: currentUser.initials,
      department: currentUser.dept,
      category,
      amount: amountNum,
      date: expenseDate,
      remark,
      receipts: [...receipts],
      status: 'pending_1st',
    }
    setClaims((prev) => [newClaim, ...prev])
    setActionMessage(
      `申請已成功遞交（${newClaim.id}），狀態為「待 GM 審批」。`,
    )
    clearForm()
  }

  /* ===== 多級審批動作（依金額分流） ===== */
  const getNextStatus = (claim) => {
    if (claim.status === 'pending_1st') {
      // 低於門檻：跳過 CEO（第 2 層），直接到最終批核（第 3 層 / Finance）
      return claim.amount < ROUTING_THRESHOLD ? 'pending_3rd' : 'pending_2nd'
    }
    if (claim.status === 'pending_2nd') return 'pending_3rd'
    return 'approved'
  }

  const handleApprove = (id) => {
    const claim = claims.find((c) => c.id === id)
    if (!claim) return
    const isAuthorized =
      (claim.status === 'pending_1st' && currentUser.isLevel1) ||
      (claim.status === 'pending_2nd' && currentUser.isLevel2) ||
      (claim.status === 'pending_3rd' && currentUser.isLevel3)
    if (!isAuthorized) {
      setActionMessage(`您沒有權限審批單據 ${id} 的目前階段（${STATUS_CONFIG[claim.status].label}）。`)
      return
    }
    const nextStatus = getNextStatus(claim)
    if (nextStatus === 'approved') {
      setClaims((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'approved' } : c)),
      )
      setActionMessage(`單據 ${id} 已完成全部審批並放款，狀態為「已核准放款」。`)
    } else {
      setClaims((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: nextStatus } : c)),
      )
      setActionMessage(`單據 ${id} 已通過審批，狀態變更為「${STATUS_CONFIG[nextStatus].label}」。`)
    }
  }

  /* ===== 駁回流程（需填寫駁回原因，Modal 彈窗） ===== */
  const handleReject = (id) => {
    setRejectTargetId(id)
    setRejectionReason('')
    setRejectError('')
  }

  const cancelReject = () => {
    setRejectTargetId(null)
    setRejectionReason('')
    setRejectError('')
  }

  const confirmReject = () => {
    const reason = rejectionReason.trim()
    if (!reason) {
      setRejectError('請輸入駁回原因（必填）。')
      return
    }
    const claim = claims.find((c) => c.id === rejectTargetId)
    if (!claim) return
    const isAuthorized =
      (claim.status === 'pending_1st' && currentUser.isLevel1) ||
      (claim.status === 'pending_2nd' && currentUser.isLevel2) ||
      (claim.status === 'pending_3rd' && currentUser.isLevel3)
    if (!isAuthorized) {
      setActionMessage(`您沒有權限駁回單據 ${rejectTargetId} 的目前階段。`)
      cancelReject()
      return
    }
    setClaims((prev) =>
      prev.map((c) =>
        c.id === rejectTargetId
          ? {
              ...c,
              status: 'rejected',
              rejectionReason: reason,
              rejectedBy: `${currentUser.name}（${currentUser.roleLabel}）`,
              rejectedAt: new Date().toISOString(),
            }
          : c,
      ),
    )
    setActionMessage(`單據 ${rejectTargetId} 已被駁回：${reason}`)
    cancelReject()
  }

  /* ===== 權限管理動作（Level 4 Finance & Admin） ===== */
  const handleTogglePermission = (empId, tier) => {
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === empId ? { ...emp, [tier]: !emp[tier] } : emp)),
    )
    const emp = employees.find((e) => e.id === empId)
    if (emp) {
      const tierLabels = {
        isLevel1: '第 1 層審批權限',
        isLevel2: '第 2 層審批權限',
        isLevel3: '第 3 層審批權限',
      }
      const tierLabel = tierLabels[tier] || '審批權限'
      setActionMessage(`${emp.name} 的${tierLabel}已${emp[tier] ? '移除' : '啟用'}。`)
    }
  }

  /* ===== 未登入：顯示 Login 頁面 ===== */
  if (!currentUser) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-card__brand">
            <div className="login-card__logo">CSG</div>
            <h1 className="login-card__title">City Service Group</h1>
            <p className="login-card__subtitle">Executive Workflow Portal</p>
          </div>
          <form className="login-form" onSubmit={handleLoginSubmit}>
            <div className="login-form__field">
              <label htmlFor="loginUsername">Username（使用者名稱）</label>
              <input
                id="loginUsername"
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="請輸入使用者名稱"
                autoComplete="username"
              />
            </div>
            <div className="login-form__field">
              <label htmlFor="loginPassword">Password（密碼）</label>
              <input
                id="loginPassword"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="請輸入密碼"
                autoComplete="current-password"
              />
            </div>
            {loginError && <p className="login-form__error">{loginError}</p>}
            <button type="submit" className="login-form__submit">
              登入（Login）
            </button>
          </form>

          <div className="login-demo">
            <p className="login-demo__title">Demo Accounts 快速點擊填入</p>
            <div className="login-demo__list">
              {TEST_ACCOUNTS.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  className="login-demo__btn"
                  onClick={() => fillDemoAccount(account)}
                >
                  <span className="login-demo__initials">{account.initials}</span>
                  <span className="login-demo__body">
                    <span className="login-demo__name">{account.username}</span>
                    <span className="login-demo__role">
                      {account.roleLabel}（{account.dept}）
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ===== 登入後的檢視資料（依目前使用者權限） ===== */
  const visibleMenu = MENU_ITEMS.filter((item) => item.minLevel <= currentUser.accessLevel)
  const pendingForUser = claims.filter((c) => c.status === 'pending_1st' && currentUser.isLevel1)
  const pending2ndForUser = claims.filter((c) => c.status === 'pending_2nd' && currentUser.isLevel2)
  const pending3rdForUser = claims.filter((c) => c.status === 'pending_3rd' && currentUser.isLevel3)
  const visiblePending = [...pendingForUser, ...pending2ndForUser, ...pending3rdForUser]
  const myClaims = claims.filter((c) => c.applicant === currentUser.name)
  const level1Count = employees.filter((e) => e.isLevel1).length
  const level2Count = employees.filter((e) => e.isLevel2).length
  const level3Count = employees.filter((e) => e.isLevel3).length
  const route = approvalRoute()

  return (
    <div className="pc-shell">
      {/* ===== 左側 Sidebar ===== */}
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__logo">CSG</div>
          <div className="sidebar__brand-text">
            <h1 className="sidebar__title">City Service Group</h1>
            <p className="sidebar__subtitle">Executive Workflow Portal</p>
          </div>
        </div>

        {/* 登入使用者資訊卡 */}
        <div className="user-badge">
          <div className="user-badge__avatar">{currentUser.initials}</div>
          <div className="user-badge__info">
            <span className="user-badge__name">{currentUser.name}</span>
            <span className="user-badge__dept">{currentUser.dept}</span>
          </div>
          <span className="user-badge__level">{currentLevel.label}</span>
        </div>

        {/* 多模組選單 */}
        <nav className="sidebar__nav">
          <p className="sidebar__section-title">MODULES</p>
          {visibleMenu.map((item) => {
            const ItemIcon = item.icon
            const pendingCount = item.id === 'pending' ? visiblePending.length : 0
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${activeModule === item.id ? 'nav-item--active' : ''}`}
                onClick={() => handleModuleClick(item)}
              >
                <ItemIcon size={17} />
                <span className="nav-item__text">
                  <span className="nav-item__label">{item.label}</span>
                  <span className="nav-item__sub">{item.sub}</span>
                </span>
                {pendingCount > 0 && <span className="nav-item__badge">{pendingCount}</span>}
              </button>
            )
          })}
        </nav>

        <div className="sidebar__footer">
          <div className="access-note">
            <IconShield size={16} />
            <p className="access-note__text">
              {currentUser.roleLabel}：{currentUser.desc}
            </p>
          </div>
        </div>
      </aside>

      {/* ===== 主內容區 ===== */}
      <main className="pc-main">
        {/* Topbar：標題 + 登入者資訊 + Logout */}
        <header className="topbar">
          <div className="topbar__title">
            <h2 className="topbar__heading">Petty Cash Reimbursement</h2>
            <p className="topbar__sub">四層角色・動態金額分流審批 · 4-Tier Roles · Amount-Based Routing</p>
          </div>
          <div className="auth-bar">
            <div className="auth-bar__user">
              <span className="auth-bar__avatar">{currentUser.initials}</span>
              <div className="auth-bar__info">
                <span className="auth-bar__name">{currentUser.name}</span>
                <span className="auth-bar__role">
                  {currentUser.roleLabel} · {currentLevel.label}
                </span>
              </div>
            </div>
            <button type="button" className="btn-logout" onClick={handleLogout}>
              Logout（登出）
            </button>
          </div>
        </header>

        {/* 目前權限提示條 */}
        <div className="level-strip">
          <span className="level-strip__tag">{currentLevel.label}</span>
          <span className="level-strip__role">{currentUser.name}（{currentUser.roleLabel}）</span>
          <span className="level-strip__desc">{currentUser.desc}</span>
        </div>

        {/* 操作結果提示 */}
        {actionMessage && <div className="action-toast">{actionMessage}</div>}

        {/* ===== 填寫報銷單（單頁表單） ===== */}
        {activeModule === 'new-claim' && (
          <>
            <section className="pc-card">
              <div className="pc-card__header">
                <h2 className="pc-card__title">
                  {editingClaimId ? `重新編輯 / 補交文件（${editingClaimId}）` : 'Petty Cash 報銷申請表'}
                </h2>
                {!editingClaimId && (
                  <button type="button" className="btn-load" onClick={loadExample}>
                    載入 Petty Cash 範例
                  </button>
                )}
              </div>

              <div className="pc-form-grid">
                <div className="pc-field">
                  <label htmlFor="applicant">申請人（鎖定為目前登入帳號）</label>
                  <input
                    id="applicant"
                    type="text"
                    value={currentUser.name}
                    readOnly
                    title="申請人鎖定為目前登入帳號"
                  />
                </div>
                <div className="pc-field">
                  <label htmlFor="department">部門</label>
                  <input
                    id="department"
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder={currentUser.dept}
                  />
                </div>
                <div className="pc-field">
                  <label htmlFor="category">費用類別</label>
                  <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">請選擇類別</option>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="pc-field">
                  <label htmlFor="amount">報銷總金額（HKD）</label>
                  <div className="pc-input-group">
                    <span className="pc-input-group__prefix">HK$</span>
                    <input
                      id="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      aria-label="報銷總金額（港幣）"
                    />
                  </div>
                </div>
                <div className="pc-field">
                  <label htmlFor="expenseDate">單據日期</label>
                  <input
                    id="expenseDate"
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="pc-field pc-field--full">
                <label htmlFor="remark">報銷事由 / 備註</label>
                <textarea
                  id="remark"
                  rows="4"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="請描述報銷事由，例如：出差拜訪客戶的交通費用..."
                />
              </div>

              {/* 單據上載區 */}
              <div className="pc-field pc-field--full">
                <label>單據上載</label>
                <div
                  className={`upload-area ${dragOver ? 'upload-area--dragging' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.jpg,.jpeg,.png"
                    className="hidden-file-input"
                    onChange={handleFileSelect}
                    aria-label="上傳單據檔案"
                  />
                  <div
                    className="upload-area__inner"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        fileInputRef.current && fileInputRef.current.click()
                      }
                    }}
                  >
                    <span className="upload-area__icon"><IconUpload size={26} /></span>
                    <p className="upload-area__text">
                      拖曳檔案至此，或 <span className="upload-area__link">瀏覽檔案</span>
                    </p>
                    <p className="upload-area__hint">支援 PDF / JPG / PNG，最多 5MB</p>
                    <button
                      type="button"
                      className="btn-upload"
                      onClick={(e) => {
                        e.stopPropagation()
                        fileInputRef.current && fileInputRef.current.click()
                      }}
                    >
                      ＋ 上傳 / 追加檔案
                    </button>
                  </div>

                  {/* OCR / AI 分析狀態 */}
                  {ocrStatus === 'loading' && (
                    <p className="ocr-badge ocr-badge--loading">✨ OCR / AI 引擎分析中...</p>
                  )}
                  {ocrStatus === 'done' && ocrResult && (
                    <div className="ocr-result">
                      <span className={`ocr-badge ${ocrResult.engine === 'gemini' ? 'ocr-badge--gemini' : 'ocr-badge--mock'}`}>
                        {ocrResult.engine === 'gemini'
                          ? '✨ Google Gemini AI 辨識成功 (Vercel Serverless)'
                          : '✨ OCR 辨識成功 (Local Demo 模式)'}
                      </span>
                      <span className="ocr-meta">
                        {ocrFileName} · 商戶：{ocrResult.merchant} · Confidence: {ocrResult.confidence}%
                      </span>
                      <span className="ocr-hint">已由 OCR 自動帶入，可手動修正</span>
                    </div>
                  )}
                  {ocrStatus === 'error' && (
                    <p className="ocr-badge ocr-badge--error">⚠️ OCR / AI 分析失敗</p>
                  )}
                  {receipts.length > 0 && (
                    <ul className="file-list">
                      {receipts.map((file) => (
                        <li key={file} className="file-chip">
                          <span className="file-chip__icon"><IconFile size={16} /></span>
                          <span className="file-chip__name">{file}</span>
                          <button
                            type="button"
                            className="file-chip__remove"
                            onClick={() => removeReceipt(file)}
                            aria-label={`移除 ${file}`}
                          >
                            <IconClose size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>

            {/* 金額門檻自動分流卡片（四層角色・動態金額分流） */}
            <section className="routing-card">
              <h2 className="routing-card__title">審批路徑預覽</h2>
              {route.length > 0 ? (
                <>
                  <p className="routing-card__tier">
                    目前金額 HK${amountNum.toLocaleString()}
                    <span className="routing-card__tier-badge">
                      {amountNum < ROUTING_THRESHOLD ? '低於 $10,000 · 免 CEO 審批' : '達 $10,000 · 需 CEO 審批'}
                    </span>
                  </p>
                  <div className="routing-track">
                    {route.map((step) => {
                      const StepIcon = step.icon
                      return (
                        <div key={step.id} className="routing-node">
                          <div className="routing-node__card">
                            <span className="routing-node__icon"><StepIcon size={16} /></span>
                            <span className="routing-node__name">{step.name}</span>
                            <span className="routing-node__code">{step.code}</span>
                          </div>
                          {step.id !== route[route.length - 1].id && (
                            <span className="routing-node__arrow"><IconArrow size={16} /></span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <>
                  <p className="routing-card__empty">
                    輸入報銷金額以自動預覽動態審批路徑。
                  </p>
                  <ul className="routing-card__rules-list">
                    <li className="routing-card__rule-item">
                      <span className="routing-card__rule-amount">金額 &lt; $10,000</span>
                      <span>GM 審核 → Finance 最終批核</span>
                    </li>
                    <li className="routing-card__rule-item">
                      <span className="routing-card__rule-amount">金額 &ge; $10,000</span>
                      <span>GM 審核 → CEO 審核 → Finance 最終批核</span>
                    </li>
                  </ul>
                </>
              )}
            </section>

            {/* 按鈕列 */}
            <footer className="pc-footer">
              <button type="button" className="btn-save" onClick={saveDraft}>儲存草稿</button>
              <button type="button" className="btn-clear" onClick={clearForm}>清除表單</button>
              <button type="button" className="btn-submit" onClick={submitForm}>
                {editingClaimId ? '重新提交 / 補交文件' : '下一步 / 遞交申請'}
              </button>
            </footer>
          </>
        )}

        {/* ===== 我的申請紀錄 ===== */}
        {activeModule === 'my-claims' && (
          <section className="pc-card">
            <div className="pc-card__header">
              <h2 className="pc-card__title">我的申請紀錄</h2>
            </div>
            {myClaims.length === 0 ? (
              <p className="empty-state">目前沒有已提交的申請紀錄。請先前往「填寫報銷單」遞交申請。</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>單據編號</th>
                    <th>費用類別</th>
                    <th>金額 (HKD)</th>
                    <th>單據日期</th>
                    <th>報銷事由</th>
                    <th>狀態</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {myClaims.map((c) => {
                    const status = STATUS_CONFIG[c.status]
                    return (
                      <tr key={c.id}>
                        <td className="data-table__id">{c.id}</td>
                        <td>{c.category}</td>
                        <td>HK${c.amount.toLocaleString()}</td>
                        <td>{c.date}</td>
                        <td className="data-table__remark">{c.remark}</td>
                        <td>
                          <span className={`status-badge ${status.className}`} title={status.en}>
                            {status.label}
                          </span>
                          {c.status === 'rejected' && (
                            <div className="rejection-note">
                              {c.rejectionReason && <p className="rejection-note__reason">駁回原因：{c.rejectionReason}</p>}
                              {c.rejectedBy && <p className="rejection-note__by">駁回者：{c.rejectedBy}</p>}
                              {c.resubmittedCount > 0 && <p className="rejection-note__by">已重新提交 {c.resubmittedCount} 次</p>}
                            </div>
                          )}
                        </td>
                        <td>
                          {c.status === 'rejected' ? (
                            <button type="button" className="btn-resubmit" onClick={() => startResubmit(c)}>
                              <IconUpload size={14} /> 重新編輯 / 補交文件
                            </button>
                          ) : (
                            <span className="table-muted">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        )}

        {/* ===== 待我審批（依目前帳號權限過濾） ===== */}
        {activeModule === 'pending' && (
          <section className="pc-card">
            <div className="pc-card__header">
              <h2 className="pc-card__title">待我審批</h2>
              <div className="pending-meta">
                <span className="pending-count">共 {visiblePending.length} 筆待處理</span>
                {currentUser.isLevel1 && (
                  <span className="tier-chip tier-chip--1st">第 1 層審批：GM</span>
                )}
                {currentUser.isLevel2 && (
                  <span className="tier-chip tier-chip--2nd">第 2 層審批：CEO</span>
                )}
                {currentUser.isLevel3 && (
                  <span className="tier-chip tier-chip--3rd">第 3 層審批：Finance 最終批核</span>
                )}
              </div>
            </div>
            {visiblePending.length === 0 ? (
              <p className="empty-state">目前沒有符合您審批權限的單據。</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>單據編號</th>
                    <th>申請人</th>
                    <th>部門</th>
                    <th>費用類別</th>
                    <th>金額 (HKD)</th>
                    <th>單據日期</th>
                    <th>報銷事由</th>
                    <th>目前階段</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePending.map((c) => {
                    const status = STATUS_CONFIG[c.status]
                    return (
                      <tr key={c.id}>
                        <td className="data-table__id">{c.id}</td>
                        <td>
                          <span className="approver-cell">
                            <span className="approver-cell__avatar">{c.applicantInitials}</span>
                            {c.applicant}
                          </span>
                        </td>
                        <td>{c.department}</td>
                        <td>{c.category}</td>
                        <td>HK${c.amount.toLocaleString()}</td>
                        <td>{c.date}</td>
                        <td className="data-table__remark">{c.remark}</td>
                        <td>
                          <span className={`status-badge ${status.className}`}>{status.label}</span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button type="button" className="btn-approve" onClick={() => handleApprove(c.id)}>
                              <IconCheck size={14} /> 同意
                            </button>
                            <button type="button" className="btn-reject" onClick={() => handleReject(c.id)}>
                              <IconClose size={14} /> 駁回
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        )}

        {/* ===== 權限管理（Level 3） ===== */}
        {activeModule === 'user-mgmt' && (
          <section className="pc-card">
            <div className="pc-card__header">
              <h2 className="pc-card__title">權限管理</h2>
              <div className="pending-meta">
                <span className="pending-count">{level1Count} 位一級審批人</span>
                <span className="pending-count">{level2Count} 位二級審批人</span>
                <span className="pending-count">{level3Count} 位終審審批人</span>
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>員工</th>
                  <th>部門</th>
                  <th>存取層級</th>
                  <th>第 1 層審批權限</th>
                  <th>第 2 層審批權限</th>
                  <th>第 3 層審批權限</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const accessLabel = LEVEL_CONFIG[emp.accessLevel]
                  return (
                    <tr key={emp.id}>
                      <td>
                        <span className="approver-cell">
                          <span className="approver-cell__avatar">{emp.initials}</span>
                          {emp.name}
                        </span>
                      </td>
                      <td>{emp.dept}</td>
                      <td>
                        <span className={`role-tag role-tag--level-${emp.accessLevel}`}>
                          {accessLabel.label} {accessLabel.role}
                        </span>
                      </td>
                      {['isLevel1', 'isLevel2', 'isLevel3'].map((tier) => (
                        <td key={tier}>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              checked={emp[tier]}
                              onChange={() => handleTogglePermission(emp.id, tier)}
                            />
                            <span className="toggle-switch__slider" />
                          </label>
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )}
      </main>

      {/* ===== 駁回原因 Modal ===== */}
      {rejectTargetId && (
        <div className="modal-overlay" onClick={cancelReject}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="輸入駁回原因"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal__title">駁回單據</h3>
            <p className="modal__desc">
              確定要駁回 <strong>{rejectTargetId}</strong> 嗎？駁回後申請人需重新編輯並補交文件。
            </p>
            <div className="pc-field">
              <label htmlFor="rejectionReason">駁回原因（必填）</label>
              <textarea
                id="rejectionReason"
                rows="3"
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value)
                  setRejectError('')
                }}
                placeholder="例如：請補上正本收據及發票"
                autoFocus
              />
            </div>
            {rejectError && <p className="modal__error">{rejectError}</p>}
            <div className="modal__actions">
              <button type="button" className="btn-clear" onClick={cancelReject}>取消</button>
              <button type="button" className="btn-reject" onClick={confirmReject}>確認駁回</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App