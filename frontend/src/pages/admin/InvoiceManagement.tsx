import React, { useEffect, useState } from 'react';
import { 
  App, Card, Table, Button, Tag, Typography, Modal, Row, Col, 
  Divider, Select, DatePicker, Space, Popconfirm, Switch, Statistic, Radio, Tabs, Progress
} from 'antd';
import { 
  PrinterOutlined, FileTextOutlined, DeleteOutlined, 
  EyeOutlined, ContainerOutlined, NumberOutlined, FilterOutlined, BankOutlined, AlertOutlined
} from '@ant-design/icons';
import { axiosInstance } from '../../api/axiosInstance';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const mealSectionOrderMap: Record<string, number> = {
  '早餐': 1,
  '早班午餐': 2,
  '早班晚餐': 3,
  '客户/顾问加餐饭盒': 4,
  '夜班餐食 10pm Buffet': 5,
  '夜班餐食 3am 宵夜': 6,
};

const sortMealDetails = (details: any[]) => {
  if (!details || !Array.isArray(details)) return [];
  return [...details].sort((a, b) => {
    const orderA = mealSectionOrderMap[a.meal_section] || 99;
    const orderB = mealSectionOrderMap[b.meal_section] || 99;
    return orderA - orderB;
  });
};

const sortSectionBreakdown = (sections: any[]) => {
  if (!sections || !Array.isArray(sections)) return [];
  return [...sections].sort((a, b) => {
    const orderA = mealSectionOrderMap[a.section_name] || 99;
    const orderB = mealSectionOrderMap[b.section_name] || 99;
    return orderA - orderB;
  });
};

const renderDueStatusTag = (r: any, cycleDays: number = 14) => {
  if (!r) return <Text type="secondary">-</Text>;
  let dueDateStr = r.due_date;
  let statusText = r.due_status_text;
  let statusType = r.due_status_type;

  if ((!dueDateStr || !statusText) && r.delivery_date) {
    const delDate = dayjs(r.delivery_date);
    const dueDate = delDate.add(cycleDays, 'day');
    dueDateStr = dueDate.format('YYYY-MM-DD');

    const today = dayjs().startOf('day');
    const diffDays = today.diff(dueDate, 'day');

    if (diffDays > 0) {
      statusType = 'overdue';
      statusText = `已逾期 ${diffDays} 天`;
    } else if (diffDays === 0) {
      statusType = 'due_today';
      statusText = '今天到期';
    } else {
      statusType = 'within_terms';
      statusText = `还有 ${Math.abs(diffDays)} 天到期`;
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <Text style={{ fontSize: 11, color: '#64748b' }}>到期日: {dueDateStr || '-'}</Text>
      {statusType === 'overdue' ? (
        <Tag color="red" style={{ fontWeight: 'bold', margin: 0 }}>🔴 {statusText || '已逾期'}</Tag>
      ) : statusType === 'due_today' ? (
        <Tag color="gold" style={{ fontWeight: 'bold', margin: 0 }}>🟡 {statusText || '今天到期'}</Tag>
      ) : (
        <Tag color="green" style={{ fontWeight: 'bold', margin: 0 }}>🟢 {statusText || '账期内正常'}</Tag>
      )}
    </div>
  );
};

export const InvoiceManagement: React.FC = () => {
  const { message } = App.useApp();
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  // 国际化文本定义
  const labels = {
    title: isEn ? 'Customer DO & Reconciliation System' : '客户 DO 送货单与账单对账系统',
    tabDoGenerator: isEn ? '1. Daily DO & Summary DO Generator' : '1. 每日DO与总DO生成',
    tabStatement: isEn ? '2. Customer DO Statement' : '2. 客户DO Statement对账单',
    tabPayments: isEn ? '3. Payments & Outstanding Balances' : '3. 还款与欠款记录',
    tabSummaryDoHistory: isEn ? '4. Consolidated DO History' : '4. 历史总DO记录',
    tabMealVolume: isEn ? '5. Meal Volume Log' : '5. 订餐数量记录',

    allCustomers: isEn ? 'All Customers' : '全部客户',
    formCustomer: isEn ? 'Select Customer' : '选择客户',
    formDateRange: isEn ? 'Date Range' : '日期范围',
    
    colDoNo: isEn ? 'DO No.' : 'DO 单号',
    colDate: isEn ? 'Delivery Date' : '送货日期',
    colCompany: isEn ? 'Customer Company' : '客户公司',
    colTotalPortions: isEn ? 'Total Portions' : '总份数',
    colTotalAmount: isEn ? 'Total Amount (RM)' : '总金额 (RM)',
    colStatus: isEn ? 'Merge Status' : '合并状态',
    colAction: isEn ? 'Actions' : '操作',

    statusUnbilled: isEn ? 'Unconsolidated DO' : '待合并总DO',
    statusBilled: isEn ? 'Merged into Summary DO' : '已合并至总DO',
    
    btnViewDo: isEn ? 'View DO' : '查看 DO 详情',
    btnGenerateInvoice: isEn ? 'Generate Summary DO' : '生成总 DO',
    btnGenerateSingle: isEn ? 'Generate 1 Summary DO' : '生成1张总DO',
    btnGenerateMulti: isEn ? 'Combine DOs to 1 Summary DO' : '多张DO合并生成1张总DO',

    colInvNo: isEn ? 'Summary DO No.' : '总 DO 编号',
    colBillingPeriod: isEn ? 'Period' : '送货区间',
    colDoList: isEn ? 'Associated DO List' : '关联DO列表',
    colPaymentStatus: isEn ? 'Status' : '状态',
    statusPaid: isEn ? 'Paid / Settled' : '已结清',
    statusUnpaid: isEn ? 'Pending Payment' : '待付欠款',
    
    btnMarkPaid: isEn ? 'Confirm Paid' : '确认已结清',
    btnMarkUnpaid: isEn ? 'Set Unpaid' : '设为待付',
    btnCancelInv: isEn ? 'Cancel Summary DO' : '撤销总 DO',
    confirmCancelInv: isEn ? 'Are you sure you want to cancel this summary DO? DOs will be released.' : '确认撤销此总 DO 吗？关联的每日 DO 将重新释放为待合并状态。',
    btnPreview: isEn ? 'Preview & Print' : '预览与打印总 DO',

    // Statement labels
    statTotalInvoiced: isEn ? 'Total DO Delivered (RM)' : '本期 DO 送货总额',
    statPaidAmount: isEn ? 'Total Payments Received (RM)' : '本期已还款金额',
    statOutstanding: isEn ? 'Outstanding Balance (RM)' : '当前未结清欠款',
    statTotalDos: isEn ? 'Total Delivery Orders' : '累计送货 DO 数',
    btnPrintStatement: isEn ? 'Print Customer DO Statement' : '一键打印客户对账单',

    brandName: isEn ? 'Kim Long Catering Meal Supply' : '金龙中央厨房餐食供应',
    billTo: isEn ? 'Bill To' : '客户单位',
    remittanceInfo: isEn ? 'Remittance Bank Details' : '收款银行资料',
    totalPayable: isEn ? 'Total Payable' : '应付总额',
    totalPortionsLabel: isEn ? 'Total Portions' : '送餐总份数',
    remarkLabel: isEn ? 'Remark: ' : '备注: ',
    btnClose: isEn ? 'Close' : '关闭',
    btnPrint: isEn ? 'Print Document' : '一键打印单据',

    colShift: isEn ? 'Shift / Section' : '餐次',
    colDetails: isEn ? 'Package / Item Details' : '套餐构成明细',
    colQty: isEn ? 'Qty' : '份数',
    colPrice: isEn ? 'Unit Price (RM)' : '单价 (RM)',
    colSubtotal: isEn ? 'Subtotal (RM)' : '小计 (RM)',
  };

  // 数据状态
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]); // Consolidated DOs
  const [dailyDos, setDailyDos] = useState<any[]>([]);
  const [mealVolumeData, setMealVolumeData] = useState<any>({ summary: {}, section_summary: [], records: [] });
  const [statementData, setStatementData] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);

  // 筛选控制状态
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [doStatusFilter, setDoStatusFilter] = useState<string>('unbilled'); // unbilled, billed, all
  const [reconcileStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('1');

  // 还款 Modal 状态与 DO 核销关联
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    customer_id: null as number | null,
    payment_date: dayjs().format('YYYY-MM-DD'),
    amount: '' as string | number,
    payment_method: 'Bank Transfer',
    reference_no: '',
    allocated_dos_text: '',
    remark: ''
  });
  const [unpaidDos, setUnpaidDos] = useState<any[]>([]);
  const [selectedDoKeysForPayment, setSelectedDoKeysForPayment] = useState<React.Key[]>([]);
  const [loadingUnpaidDos, setLoadingUnpaidDos] = useState(false);

  const fetchUnpaidDosForCustomer = async (customerId: number) => {
    if (!customerId) {
      setUnpaidDos([]);
      return;
    }
    setLoadingUnpaidDos(true);
    try {
      const cid = Number(customerId);
      const res = await axiosInstance.get(`/admin/customers/${cid}/unpaid-dos`);
      const data = Array.isArray(res.data) ? res.data : [];
      setUnpaidDos(data);
    } catch (err: any) {
      console.error("Failed to fetch unpaid DOs", err);
      message.error(isEn ? 'Failed to load customer DOs' : `加载客户送货单 DO 失败: ${err.response?.data?.detail || err.message}`);
      setUnpaidDos([]);
    } finally {
      setLoadingUnpaidDos(false);
    }
  };

  const handleUnpaidDoSelectionChange = (newSelectedKeys: React.Key[]) => {
    setSelectedDoKeysForPayment(newSelectedKeys);
    const selectedDos = unpaidDos.filter(d => newSelectedKeys.includes(d.order_id));
    const sumAmt = selectedDos.reduce((acc, d) => acc + (d.amount || 0), 0);
    const doNums = selectedDos.map(d => d.do_number).join(', ');

    setPaymentForm(prev => ({
      ...prev,
      amount: sumAmt > 0 ? sumAmt.toFixed(2) : prev.amount,
      allocated_dos_text: doNums
    }));
  };

  // 列表加载状态
  const [loadingDos, setLoadingDos] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [loadingVolume, setLoadingVolume] = useState(false);

  // 选中 DO 生成 Invoice
  const [selectedDoKeys, setSelectedDoKeys] = useState<React.Key[]>([]);
  const [selectedDosAmount, setSelectedDosAmount] = useState<number>(0);
  const [selectedDosPortions, setSelectedDosPortions] = useState<number>(0);

  // Modal 控制
  const [doModalVisible, setDoModalVisible] = useState(false);
  const [selectedDoDetail, setSelectedDoDetail] = useState<any | null>(null);

  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  const [statementModalVisible, setStatementModalVisible] = useState(false);
  const [showPricesOnPrint, setShowPricesOnPrint] = useState<boolean>(true);

  // 初始加载
  const fetchCustomers = async () => {
    try {
      const res = await axiosInstance.get('/admin/customers');
      setCustomers(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInvoices = async (custId?: number | null) => {
    setLoadingInvoices(true);
    try {
      const res = await axiosInstance.get('/admin/invoices');
      let data = res.data || [];
      if (custId) {
        data = data.filter((inv: any) => inv.customer_id === custId);
      }
      setInvoices(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const fetchDailyDos = async (custId?: number | null, stFilter = doStatusFilter) => {
    setLoadingDos(true);
    setSelectedDoKeys([]);
    setSelectedDosAmount(0);
    setSelectedDosPortions(0);
    try {
      const params: any = {};
      if (stFilter !== 'all') params.status_filter = stFilter;
      if (custId) params.customer_id = custId;
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }
      const res = await axiosInstance.get('/admin/invoices/daily-dos', { params });
      setDailyDos(res.data || []);
    } catch (err) {
      console.error(err);
      setDailyDos([]);
    } finally {
      setLoadingDos(false);
    }
  };

  const fetchReconciliationDos = async (custId?: number | null, stFilter = reconcileStatusFilter) => {
    try {
      const params: any = {};
      if (stFilter !== 'all') params.status_filter = stFilter;
      if (custId) params.customer_id = custId;
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }
      await axiosInstance.get('/admin/invoices/daily-dos', { params });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStatement = async (custId?: number | null) => {
    // 如果没有选特定客户，默认查客户列表中第1个进行呈现
    const targetId = custId || (customers.length > 0 ? customers[0].id : null);
    if (!targetId) return;
    setLoadingStatement(true);
    try {
      const params: any = { customer_id: targetId };
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }
      const res = await axiosInstance.get('/admin/invoices/statement', { params });
      setStatementData(res.data);
    } catch (err) {
      console.error(err);
      setStatementData(null);
    } finally {
      setLoadingStatement(false);
    }
  };

  const fetchMealVolume = async (custId?: number | null) => {
    setLoadingVolume(true);
    try {
      const params: any = {};
      if (custId) params.customer_id = custId;
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }
      const res = await axiosInstance.get('/admin/invoices/meal-volume', { params });
      setMealVolumeData(res.data || { summary: {}, section_summary: [], records: [] });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingVolume(false);
    }
  };

  const fetchPayments = async (custId?: number | null) => {
    try {
      const params: any = {};
      if (custId) params.customer_id = custId;
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }
      const res = await axiosInstance.get('/admin/payments', { params });
      setPayments(res.data || []);
    } catch (err) {
      console.error(err);
      setPayments([]);
    }
  };

  const handleCreatePayment = async () => {
    if (!paymentForm.customer_id) {
      message.warning(isEn ? 'Please select customer' : '请选择付款客户');
      return;
    }
    const numAmt = parseFloat(paymentForm.amount as string);
    if (!numAmt || numAmt <= 0) {
      message.warning(isEn ? 'Please enter valid payment amount' : '请输入有效的还款金额');
      return;
    }
    try {
      await axiosInstance.post('/admin/payments', {
        customer_id: paymentForm.customer_id,
        payment_date: paymentForm.payment_date,
        amount: numAmt,
        payment_method: paymentForm.payment_method,
        reference_no: paymentForm.reference_no,
        allocated_dos_text: paymentForm.allocated_dos_text,
        do_ids: selectedDoKeysForPayment.map(k => Number(k)),
        remark: paymentForm.remark
      });
      message.success(isEn ? 'Payment recorded successfully' : '还款/打款记录登记成功！');
      setPaymentModalVisible(false);
      setSelectedDoKeysForPayment([]);
      setUnpaidDos([]);
      setPaymentForm({
        customer_id: selectedCustomer || null,
        payment_date: dayjs().format('YYYY-MM-DD'),
        amount: '',
        payment_method: 'Bank Transfer',
        reference_no: '',
        allocated_dos_text: '',
        remark: ''
      });
      fetchPayments(selectedCustomer);
      fetchStatement(selectedCustomer);
    } catch (err: any) {
      const msg = err.response?.data?.detail || (isEn ? 'Failed to add payment' : '登记还款失败');
      message.error(msg);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    try {
      await axiosInstance.delete(`/admin/payments/${paymentId}`);
      message.success(isEn ? 'Payment record deleted' : '还款记录已顺利删除');
      fetchPayments(selectedCustomer);
      fetchStatement(selectedCustomer);
    } catch (err: any) {
      message.error(isEn ? 'Failed to delete payment' : '删除还款记录失败');
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    fetchDailyDos(selectedCustomer, doStatusFilter);
    fetchInvoices(selectedCustomer);
    fetchStatement(selectedCustomer);
    fetchReconciliationDos(selectedCustomer, reconcileStatusFilter);
    fetchMealVolume(selectedCustomer);
    fetchPayments(selectedCustomer);
  }, [selectedCustomer, dateRange, doStatusFilter, reconcileStatusFilter]);

  // 当还款 Modal 弹出且已选客户时，自动加载该客户的还款 DO 列表
  useEffect(() => {
    if (paymentModalVisible && paymentForm.customer_id) {
      fetchUnpaidDosForCustomer(paymentForm.customer_id);
    }
  }, [paymentModalVisible, paymentForm.customer_id]);

  // 1. 生成总 DO 请求 (选中单张 DO 或 多张 DO 合并生成 1 张总 DO)
  const handleGenerateInvoiceFromDos = async () => {
    if (selectedDoKeys.length === 0) {
      message.warning(isEn ? 'Please select at least one DO' : '请勾选需要合并生成总 DO 的送货单 DO');
      return;
    }

    // 检查是否选中的 DO 属于同一个客户
    const selectedRows = dailyDos.filter(d => selectedDoKeys.includes(d.order_id));
    const firstCustId = selectedRows[0]?.customer_id;
    const sameCust = selectedRows.every(r => r.customer_id === firstCustId);

    if (!sameCust) {
      message.error(isEn ? 'Selected DOs belong to different customers! Please select DOs from the same customer.' : '所选的 DO 属于不同客户！合并生成总 DO 时请选择同一客户的 DO。');
      return;
    }

    try {
      await axiosInstance.post('/admin/invoices', {
        customer_id: firstCustId,
        order_ids: selectedDoKeys as number[]
      });
      message.success(isEn ? 'Summary DO generated successfully!' : '已成功将所选 DO 合并生成 1 张总 DO！');
      setSelectedDoKeys([]);
      setSelectedDosAmount(0);
      setSelectedDosPortions(0);
      fetchDailyDos(selectedCustomer, doStatusFilter);
      fetchInvoices(selectedCustomer);
      fetchStatement(selectedCustomer);
      fetchReconciliationDos(selectedCustomer, reconcileStatusFilter);
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || (isEn ? 'Failed to generate summary DO' : '生成总 DO 失败');
      message.error(errMsg);
    }
  };

  // 更改发票付款状态
  const handleTogglePaymentStatus = async (record: any) => {
    const nextStatus = record.status === 'PAID' ? 'unpaid' : 'paid';
    try {
      await axiosInstance.put(`/admin/invoices/${record.id}/status`, { status: nextStatus });
      message.success(isEn ? 'Payment status updated' : '付款状态更新成功');
      fetchInvoices(selectedCustomer);
      fetchStatement(selectedCustomer);
    } catch (err) {
      message.error(isEn ? 'Failed to update status' : '更新状态失败');
    }
  };

  // 作废发票 (把状态置为 cancelled，DO 自动回退释放，发票留痕)
  const handleVoidInvoice = async (record: any) => {
    try {
      await axiosInstance.put(`/admin/invoices/${record.id}/status`, { status: 'cancelled' });
      message.success(isEn ? 'Invoice voided & DOs released successfully!' : '发票已成功作废，关联的 DO 已顺利回退！');
      fetchInvoices(selectedCustomer);
      fetchDailyDos(selectedCustomer, doStatusFilter);
      fetchStatement(selectedCustomer);
      fetchReconciliationDos(selectedCustomer, reconcileStatusFilter);
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || (isEn ? 'Failed to void invoice' : '作废发票失败');
      message.error(errMsg);
    }
  };

  // 彻底删除发票记录
  const handleDeleteInvoice = async (record: any) => {
    try {
      await axiosInstance.delete(`/admin/invoices/${record.id}`);
      message.success(isEn ? 'Invoice record deleted permanently' : '发票记录已彻底删除');
      fetchInvoices(selectedCustomer);
      fetchDailyDos(selectedCustomer, doStatusFilter);
      fetchStatement(selectedCustomer);
      fetchReconciliationDos(selectedCustomer, reconcileStatusFilter);
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || (isEn ? 'Failed to delete record' : '彻底删除记录失败');
      message.error(errMsg);
    }
  };

  // 独立通用打印函数 (支持 A4 全宽适配、防截断、隐藏分页器与打印无用元素)
  const handlePrintContainer = (containerId: string) => {
    const styleId = 'custom-print-style';
    let style = document.getElementById(styleId) as HTMLStyleElement;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    const isMealVolumeReport = containerId === 'volume-full-print-container';
    const pageOrientation = isMealVolumeReport ? 'landscape' : 'portrait';
    style.innerHTML = `
      @media print {
        @page {
          size: A4 ${pageOrientation};
          margin: ${isMealVolumeReport ? '8mm' : '12mm 10mm'};
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
          background: #fff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body * { visibility: hidden !important; }
        #${containerId}, #${containerId} * { visibility: visible !important; }
        #${containerId} {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          overflow: visible !important;
          background: #fff !important;
        }
        #${containerId} .ant-table-wrapper,
        #${containerId} .ant-spin-nested-loading,
        #${containerId} .ant-spin-container,
        #${containerId} .ant-table {
          width: 100% !important;
          max-width: 100% !important;
        }
        #${containerId} .ant-table-container, #${containerId} .ant-table-content {
          overflow: visible !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        #${containerId} table {
          width: 100% !important;
          min-width: 0 !important;
          table-layout: ${isMealVolumeReport ? 'fixed' : 'auto'} !important;
        }
        #${containerId} th, #${containerId} td {
          white-space: ${isMealVolumeReport ? 'normal' : 'nowrap'} !important;
          overflow-wrap: anywhere !important;
          word-break: break-word !important;
          font-size: ${isMealVolumeReport ? '8.5pt' : '11px'} !important;
          line-height: 1.2 !important;
          padding: ${isMealVolumeReport ? '4px 5px' : '6px 8px'} !important;
          vertical-align: middle !important;
        }
        /* 允许明细文本例正常折行 */
        #${containerId} td.cell-break, #${containerId} .breakdown-cell {
          white-space: normal !important;
          word-break: break-word !important;
        }
        #${containerId} .ant-tag {
          font-size: 10px !important;
          padding: 0 4px !important;
          margin: 1px !important;
        }
        /* 隐藏打印无用的翻页器、按钮及 no-print 元素 */
        #${containerId} thead { display: table-header-group !important; }
        #${containerId} tfoot { display: table-footer-group !important; }
        #${containerId} tr,
        #${containerId} .ant-card {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        ${isMealVolumeReport ? `
          #${containerId} .ant-card-body { padding: 7px 9px !important; }
          #${containerId} .ant-statistic-title { font-size: 8.5pt !important; margin-bottom: 2px !important; }
          #${containerId} .ant-statistic-content { font-size: 15pt !important; line-height: 1.2 !important; }
          #${containerId} .volume-records-table col:nth-child(1) { width: 14% !important; }
          #${containerId} .volume-records-table col:nth-child(2) { width: 9% !important; }
          #${containerId} .volume-records-table col:nth-child(3) { width: 18% !important; }
          #${containerId} .volume-records-table col:nth-child(4) { width: 31% !important; }
          #${containerId} .volume-records-table col:nth-child(5) { width: 9% !important; }
          #${containerId} .volume-records-table col:nth-child(6) { width: 9% !important; }
          #${containerId} .volume-records-table col:nth-child(7) { width: 10% !important; }
          #${containerId} .ant-table-content::-webkit-scrollbar { display: none !important; }
        ` : ''}
        #${containerId} .ant-pagination, #${containerId} .ant-pagination *,
        #${containerId} .no-print, #${containerId} .no-print * {
          display: none !important;
        }
      }
    `;
    window.print();
    window.addEventListener('afterprint', () => style.remove(), { once: true });
  };

  // 翻译套餐与餐次名称
  const translateMealSection = (name: string) => {
    if (!isEn) return name;
    const map: Record<string, string> = {
      '早餐': 'Breakfast',
      '早班午餐': 'Day Shift Lunch',
      '早班晚餐': 'Day Shift Dinner',
      '客户/顾问加餐饭盒': 'Visitor Bento',
      '夜班餐食 10pm Buffet': 'Night Shift 10pm Buffet',
      '夜班餐食 3am 宵夜': 'Night Shift 3am Supper',
      '上午餐': 'Morning Meal',
      '午餐': 'Lunch',
      '晚餐': 'Dinner'
    };
    return map[name] || name;
  };

  return (
    <Card 
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <Space align="center" size="middle">
            <ContainerOutlined style={{ fontSize: 24, color: '#2563eb' }} />
            <Title level={4} style={{ margin: 0 }}>{labels.title}</Title>
          </Space>
          
          <Space size="middle" wrap>
            <Select 
              placeholder={labels.formCustomer} 
              style={{ minWidth: 280 }} 
              size="middle"
              onChange={(val) => setSelectedCustomer(val)}
              value={selectedCustomer}
              allowClear
            >
              <Option value={null}>{labels.allCustomers}</Option>
              {customers.map((c) => (
                <Option key={c.id} value={c.id}>{c.company_name}</Option>
              ))}
            </Select>
            <RangePicker 
              value={dateRange}
              onChange={(dates) => setDateRange(dates as any)}
              placeholder={[isEn ? 'Start Date' : '开始日期', isEn ? 'End Date' : '结束日期']}
            />
          </Space>
        </div>
      }
      style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
    >
      {/* 自定义分页导航栏 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: '1', label: labels.tabDoGenerator, bg: '#1d4ed8' },
          { key: '2', label: labels.tabStatement,   bg: '#15803d' },
          { key: '3', label: labels.tabPayments,    bg: '#b45309' },
          { key: '4', label: labels.tabSummaryDoHistory, bg: '#7c3aed' },
          { key: '5', label: labels.tabMealVolume,  bg: '#0f766e' },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 20px',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 14,
                transition: 'all 0.2s',
                background: isActive ? tab.bg : '#f1f5f9',
                color: isActive ? '#ffffff' : '#64748b',
                boxShadow: isActive ? `0 4px 12px ${tab.bg}55` : 'none',
                transform: isActive ? 'translateY(-1px)' : 'none',
              }}
            >
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: isActive ? 'rgba(255,255,255,0.25)' : tab.bg,
                color: '#fff',
                fontSize: 12,
                fontWeight: 900,
                flexShrink: 0,
              }}>{tab.key}</span>
              {tab.label.replace(/^\d+\.\s*/, '')}
            </button>
          );
        })}
      </div>

      {/* 分页内容区 */}
      <div>
        {/* ========================================================================= */}
        {/* Tab 1: 每日 DO 整合与选 DO 生成 Invoice (1单或多单合并)                 */}
        {/* ========================================================================= */}
        {activeTab === '1' && (
          <>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <Space wrap size="middle">
                <Text style={{ fontWeight: '500' }}>{isEn ? 'DO Status Filter:' : 'DO 状态查看:'}</Text>
                <Radio.Group 
                  value={doStatusFilter} 
                  onChange={(e) => setDoStatusFilter(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                >
                  <Radio.Button value="unbilled">{labels.statusUnbilled}</Radio.Button>
                  <Radio.Button value="billed">{labels.statusBilled}</Radio.Button>
                  <Radio.Button value="all">{isEn ? 'All DOs' : '全部 DO'}</Radio.Button>
                </Radio.Group>
              </Space>

              {selectedDoKeys.length > 0 && (
                <Space size="middle" align="center">
                  <Text style={{ fontSize: 15 }}>
                    {isEn ? 'Selected:' : '已选中:'} <Text strong style={{ color: '#2563eb' }}>{selectedDoKeys.length}</Text> 张 DO ({selectedDosPortions} 份)
                  </Text>
                  <Text style={{ fontSize: 15 }}>
                    {isEn ? 'Subtotal:' : '总金额:'} <Text strong style={{ color: '#dc2626', fontSize: 18 }}>RM {selectedDosAmount.toFixed(2)}</Text>
                  </Text>
                  <Button 
                    type="primary" 
                    size="large" 
                    onClick={handleGenerateInvoiceFromDos} 
                    style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 'bold' }}
                  >
                    {selectedDoKeys.length === 1 ? labels.btnGenerateSingle : labels.btnGenerateMulti}
                  </Button>
                </Space>
              )}
            </div>

            <Table 
              loading={loadingDos}
              dataSource={dailyDos}
              rowKey="order_id"
              scroll={{ x: 'max-content' }}
              rowSelection={{
                selectedRowKeys: selectedDoKeys,
                onChange: (selectedKeys, selectedRows) => {
                  setSelectedDoKeys(selectedKeys);
                  const sumAmt = selectedRows.reduce((acc, row) => acc + (row.total_amount || 0), 0);
                  const sumPortions = selectedRows.reduce((acc, row) => acc + (row.total_portions || 0), 0);
                  setSelectedDosAmount(sumAmt);
                  setSelectedDosPortions(sumPortions);
                }
              }}
              columns={[
                { 
                  title: labels.colDoNo, 
                  dataIndex: 'do_number', 
                  render: (t: string) => <Tag color="blue" style={{ fontWeight: 'bold', fontSize: 13 }}>{t}</Tag> 
                },
                { title: labels.colDate, dataIndex: 'delivery_date', render: (d: string) => <Text strong>{d}</Text> },
                { title: labels.colCompany, dataIndex: 'company_name' },
                { 
                  title: labels.colTotalPortions, 
                  dataIndex: 'total_portions', 
                  render: (v: number) => <Text strong style={{ color: '#2563eb' }}>{v} {isEn ? 'pax' : '份'}</Text> 
                },
                { 
                  title: labels.colTotalAmount, 
                  dataIndex: 'total_amount', 
                  render: (val: number) => <Text strong style={{ color: '#dc2626', fontSize: 15 }}>RM {val.toFixed(2)}</Text> 
                },
                {
                  title: labels.colStatus,
                  dataIndex: 'status',
                  render: (st: string, r: any) => st === 'billed' 
                    ? <Tag color="green">{labels.statusBilled} ({r.invoice_number})</Tag> 
                    : <Tag color="orange">{labels.statusUnbilled}</Tag>
                },
                {
                  title: labels.colAction,
                  key: 'action',
                  render: (r: any) => (
                    <Button 
                      size="small" 
                      icon={<EyeOutlined />} 
                      onClick={() => {
                        setSelectedDoDetail(r);
                        setDoModalVisible(true);
                      }}
                    >
                      {labels.btnViewDo}
                    </Button>
                  )
                }
              ]}
            />
          </>
        )}

        {/* ========================================================================= */}
        {/* Tab 2: 客户 Statement 对账单系统 (SOA)                                    */}
        {/* ========================================================================= */}
        {activeTab === '2' && (
          <>
            {statementData && statementData.summary ? (
              <div>
                <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                  <Col xs={24} sm={12} md={6}>
                    <Card style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
                      <Statistic title={labels.statTotalInvoiced} value={statementData.summary.total_invoiced} precision={2} prefix="RM " valueStyle={{ color: '#0f172a', fontWeight: 'bold' }} />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Card style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                      <Statistic title={labels.statPaidAmount} value={statementData.summary.paid_amount} precision={2} prefix="RM " valueStyle={{ color: '#16a34a', fontWeight: 'bold' }} />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Card style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
                      <Statistic title={labels.statOutstanding} value={statementData.summary.outstanding_balance} precision={2} prefix="RM " valueStyle={{ color: '#dc2626', fontWeight: 'bold' }} />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Card style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
                      <Statistic title={labels.statTotalDos} value={statementData.summary.total_dos} suffix={`(${statementData.summary.total_portions} ${isEn ? 'pax' : '份'})`} valueStyle={{ color: '#2563eb', fontWeight: 'bold' }} />
                    </Card>
                  </Col>
                </Row>

                {/* 期初/期末余额流动分析卡片 (Balance Flow B/F & C/F) */}
                <Card style={{ marginBottom: 20, background: '#fff', borderColor: '#e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>{isEn ? 'Balance Flow' : '期初与期末余额流动分析'}</Title>
                  <Row gutter={16} align="middle" justify="space-around" style={{ textAlign: 'center' }}>
                    <Col>
                      <Text type="secondary">{isEn ? 'Balance B/F' : '期初结余'}</Text>
                      <div style={{ fontSize: 18, fontWeight: 'bold', color: '#64748b' }}>
                        RM {((statementData.summary.outstanding_balance || 0) - (statementData.summary.total_invoiced || 0) + (statementData.summary.paid_amount || 0)).toFixed(2)}
                      </div>
                    </Col>
                    <Col><Text style={{ fontSize: 24, color: '#94a3b8' }}>+</Text></Col>
                    <Col>
                      <Text type="secondary">{isEn ? 'Invoiced Amount' : '本期新增开票'}</Text>
                      <div style={{ fontSize: 18, fontWeight: 'bold', color: '#0f172a' }}>
                        RM {(statementData.summary.total_invoiced || 0).toFixed(2)}
                      </div>
                    </Col>
                    <Col><Text style={{ fontSize: 24, color: '#94a3b8' }}>-</Text></Col>
                    <Col>
                      <Text type="secondary">{isEn ? 'Paid Amount' : '本期已付款金额'}</Text>
                      <div style={{ fontSize: 18, fontWeight: 'bold', color: '#16a34a' }}>
                        RM {(statementData.summary.paid_amount || 0).toFixed(2)}
                      </div>
                    </Col>
                    <Col><Text style={{ fontSize: 24, color: '#94a3b8' }}>=</Text></Col>
                    <Col>
                      <Text type="secondary">{isEn ? 'Balance C/F' : '期末应收总额'}</Text>
                      <div style={{ fontSize: 24, fontWeight: '900', color: '#dc2626' }}>
                        RM {(statementData.summary.outstanding_balance || 0).toFixed(2)}
                      </div>
                    </Col>
                  </Row>
                </Card>

                {/* 依据客户签约账期的账龄履约与逾期分析 */}
                {statementData.terms_aging && (
                  <Card 
                    size="small" 
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{isEn ? 'Customer Credit Terms & Overdue Analysis' : `账期账龄分析 (依据客户签约的 ${statementData.terms_aging.cycle_days} 天账期)`}</span>
                        {statementData.terms_aging.total_overdue.amount > 0 ? (
                          <Tag color="red" style={{ fontWeight: 'bold' }}>
                            {isEn ? `Overdue: RM ${statementData.terms_aging.total_overdue.amount.toFixed(2)}` : `已超出账期逾期金额: RM ${statementData.terms_aging.total_overdue.amount.toFixed(2)}`}
                          </Tag>
                        ) : (
                          <Tag color="green" style={{ fontWeight: 'bold' }}>
                            {isEn ? '🟢 Within Credit Terms' : `🟢 均在约定 ${statementData.terms_aging.cycle_days} 天账期内，无逾期`}
                          </Tag>
                        )}
                      </div>
                    }
                    style={{ marginBottom: 20, borderColor: '#bfdbfe', background: '#f0f9ff' }}
                  >
                    <Row gutter={16} style={{ textAlign: 'center' }}>
                      <Col span={6}>
                        <div style={{ padding: '8px 4px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #86efac' }}>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{isEn ? 'Within Credit Terms' : `账期内 (未到期)`}</Text>
                          <div style={{ fontWeight: 'bold', fontSize: 17, color: '#16a34a', margin: '2px 0' }}>RM {statementData.terms_aging.within_terms.amount.toFixed(2)}</div>
                          <Text type="secondary" style={{ fontSize: 11 }}>({statementData.terms_aging.within_terms.count} {isEn ? 'DOs' : '笔送货 DO'})</Text>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div style={{ padding: '8px 4px', background: '#fffbe8', borderRadius: 6, border: '1px solid #ffe58f' }}>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{isEn ? 'Overdue 1-7 Days' : '逾期 1 - 7 天'}</Text>
                          <div style={{ fontWeight: 'bold', fontSize: 17, color: '#d97706', margin: '2px 0' }}>RM {statementData.terms_aging.overdue_1_7.amount.toFixed(2)}</div>
                          <Text type="secondary" style={{ fontSize: 11 }}>({statementData.terms_aging.overdue_1_7.count} {isEn ? 'DOs' : '笔送货 DO'})</Text>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div style={{ padding: '8px 4px', background: '#fff7ed', borderRadius: 6, border: '1px solid #ffbb96' }}>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{isEn ? 'Overdue 8-14 Days' : '逾期 8 - 14 天'}</Text>
                          <div style={{ fontWeight: 'bold', fontSize: 17, color: '#ea580c', margin: '2px 0' }}>RM {statementData.terms_aging.overdue_8_14.amount.toFixed(2)}</div>
                          <Text type="secondary" style={{ fontSize: 11 }}>({statementData.terms_aging.overdue_8_14.count} {isEn ? 'DOs' : '笔送货 DO'})</Text>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div style={{ padding: '8px 4px', background: '#fef2f2', borderRadius: 6, border: '1px solid #fca5a5' }}>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{isEn ? 'Overdue 15 Days+' : '逾期 15 天以上'}</Text>
                          <div style={{ fontWeight: 'bold', fontSize: 17, color: '#dc2626', margin: '2px 0' }}>RM {(statementData.terms_aging.overdue_15_30.amount + statementData.terms_aging.overdue_over_30.amount).toFixed(2)}</div>
                          <Text type="secondary" style={{ fontSize: 11 }}>({statementData.terms_aging.overdue_15_30.count + statementData.terms_aging.overdue_over_30.count} {isEn ? 'DOs' : '笔送货 DO'})</Text>
                        </div>
                      </Col>
                    </Row>
                  </Card>
                )}

                {/* 标准 0-30天 / 31-60天 / 61-90天 / 90天以上 账期账龄分析 */}
                {statementData.aging && (
                  <Card 
                    size="small" 
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{isEn ? 'Aging Breakdown' : '账期账龄分析'}</span>
                        {statementData.aging.days_over_90?.amount > 0 ? (
                          <Tag color="error" style={{ fontWeight: 'bold' }}>{isEn ? '⚠️ Severe Overdue >90 Days' : '⚠️ 存在 90 天以上严重逾期款'}</Tag>
                        ) : statementData.aging.days_61_90?.amount > 0 ? (
                          <Tag color="warning" style={{ fontWeight: 'bold' }}>{isEn ? '⚠️ Overdue >60 Days' : '⚠️ 存在 60 天以上拖欠款项'}</Tag>
                        ) : (
                          <Tag color="success" style={{ fontWeight: 'bold' }}>{isEn ? '🟢 Healthy Aging' : '🟢 账龄结构健康'}</Tag>
                        )}
                      </div>
                    } 
                    style={{ marginBottom: 20, background: '#ffffff', borderColor: '#e2e8f0' }}
                  >
                    <Row gutter={16} style={{ textAlign: 'center' }}>
                      <Col span={6}>
                        <div style={{ padding: '8px 4px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>0 - 30 天</Text>
                          <div style={{ fontWeight: 'bold', fontSize: 17, color: '#16a34a', margin: '2px 0' }}>RM {(statementData.aging.current?.amount || 0).toFixed(2)}</div>
                          <Text type="secondary" style={{ fontSize: 11 }}>({statementData.aging.current?.count || 0} 笔送货 DO)</Text>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div style={{ padding: '8px 4px', background: '#fffbe8', borderRadius: 6, border: '1px solid #ffe58f' }}>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>31 - 60 天</Text>
                          <div style={{ fontWeight: 'bold', fontSize: 17, color: '#d97706', margin: '2px 0' }}>RM {(statementData.aging.days_31_60?.amount || 0).toFixed(2)}</div>
                          <Text type="secondary" style={{ fontSize: 11 }}>({statementData.aging.days_31_60?.count || 0} 笔送货 DO)</Text>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div style={{ padding: '8px 4px', background: '#fff7ed', borderRadius: 6, border: '1px solid #ffbb96' }}>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>61 - 90 天</Text>
                          <div style={{ fontWeight: 'bold', fontSize: 17, color: '#ea580c', margin: '2px 0' }}>RM {(statementData.aging.days_61_90?.amount || 0).toFixed(2)}</div>
                          <Text type="secondary" style={{ fontSize: 11 }}>({statementData.aging.days_61_90?.count || 0} 笔送货 DO)</Text>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div style={{ padding: '8px 4px', background: '#fef2f2', borderRadius: 6, border: '1px solid #fca5a5' }}>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>90 天以上</Text>
                          <div style={{ fontWeight: 'bold', fontSize: 17, color: '#dc2626', margin: '2px 0' }}>RM {(statementData.aging.days_over_90?.amount || 0).toFixed(2)}</div>
                          <Text type="secondary" style={{ fontSize: 11 }}>({statementData.aging.days_over_90?.count || 0} 笔送货 DO)</Text>
                        </div>
                      </Col>
                    </Row>
                  </Card>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Title level={5} style={{ margin: 0 }}>
                    {statementData.customer?.company_name} - {isEn ? 'Statement Breakdown' : '对账单明细汇总'}
                  </Title>
                  <Button 
                    type="primary" 
                    size="large"
                    icon={<PrinterOutlined />} 
                    onClick={() => setStatementModalVisible(true)}
                    style={{ background: '#15803d', borderColor: '#15803d', fontWeight: 'bold' }}
                  >
                    {labels.btnPrintStatement}
                  </Button>
                </div>

                <Table 
                  loading={loadingStatement}
                  dataSource={statementData.dos || []}
                  rowKey="order_id"
                  scroll={{ x: 'max-content' }}
                  columns={[
                    { title: labels.colDoNo, dataIndex: 'do_number', align: 'center', render: (t: string) => <Text strong style={{ color: '#2563eb' }}>{t}</Text> },
                    { title: labels.colDate, dataIndex: 'delivery_date', align: 'center' },
                    { 
                      title: isEn ? 'Due Date & Aging' : '约定到期日与账龄到期状态', 
                      key: 'due_status',
                      align: 'center',
                      render: (_: any, r: any) => renderDueStatusTag(r, statementData.terms_aging?.cycle_days || 30)
                    },
                    { title: labels.colTotalPortions, dataIndex: 'total_portions', align: 'center', render: (v: number) => `${v} ${isEn ? 'pax' : '份'}` },
                    { title: labels.colTotalAmount, dataIndex: 'amount', align: 'center', render: (v: number) => <Text strong style={{ color: '#dc2626' }}>RM {v.toFixed(2)}</Text> },
                    { 
                      title: isEn ? 'Merge Status' : '是否已合并总DO', 
                      key: 'billed',
                      align: 'center',
                      render: (r: any) => r.is_billed 
                        ? <Tag color="green">{labels.statusBilled} ({r.invoice_number})</Tag> 
                        : <Tag color="volcano">{labels.statusUnbilled}</Tag>
                    }
                  ]}
                />
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <Text type="secondary">{isEn ? 'Please select a customer above to view Statement.' : '请在顶部下拉菜单中选择客户以生成对账单 (SOA)。'}</Text>
              </div>
            )}
          </>
        )}

        {/* ========================================================================= */}
        {/* Tab 3: 还款与欠款记录 (Payments & Outstanding Balances)                  */}
        {/* ========================================================================= */}
        {activeTab === '3' && (
          <>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <Title level={5} style={{ margin: 0 }}>
                  {isEn ? 'Payment Receipts & Outstanding Ledger' : '客户打款/还款流水与欠款核销台账'}
                </Title>
                <Text type="secondary">
                  {isEn ? 'Record customer payments to offset DO amounts and track outstanding balances.' : '登记客户汇款/打款记录，实时扣减 DO 供餐欠款金额。'}
                </Text>
              </div>

              <Button 
                type="primary" 
                size="large"
                icon={<BankOutlined />} 
                onClick={() => {
                  const custId = selectedCustomer || (statementData?.customer?.id) || (customers.length > 0 ? customers[0].id : null);
                  setPaymentForm({
                    customer_id: custId,
                    payment_date: dayjs().format('YYYY-MM-DD'),
                    amount: '',
                    payment_method: 'Bank Transfer',
                    reference_no: '',
                    allocated_dos_text: '',
                    remark: ''
                  });
                  setSelectedDoKeysForPayment([]);
                  if (custId) {
                    fetchUnpaidDosForCustomer(custId);
                  } else {
                    setUnpaidDos([]);
                  }
                  setPaymentModalVisible(true);
                }}
                style={{ background: '#b45309', borderColor: '#b45309', fontWeight: 'bold' }}
              >
                {isEn ? 'Record Customer Payment' : '登记客户还款 / 打款'}
              </Button>
            </div>

            {/* 客户欠款与打款概览 */}
            {statementData && statementData.summary && (
              <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                <Col xs={24} sm={8}>
                  <Card size="small" style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}>
                    <Statistic 
                      title={isEn ? 'Total DO Delivered Amount' : '客户历史送货 DO 总额'} 
                      value={statementData.summary.total_all_dos_amount || 0} 
                      precision={2} 
                      prefix="RM " 
                      valueStyle={{ color: '#0f172a', fontWeight: 'bold' }} 
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card size="small" style={{ background: '#f0fdf4', borderColor: '#86efac' }}>
                    <Statistic 
                      title={isEn ? 'Total Payments Received' : '累计已收到还款总额'} 
                      value={statementData.summary.total_all_paid_amount || 0} 
                      precision={2} 
                      prefix="RM " 
                      valueStyle={{ color: '#16a34a', fontWeight: 'bold' }} 
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card size="small" style={{ background: '#fef2f2', borderColor: '#fca5a5' }}>
                    <Statistic 
                      title={isEn ? 'Current Outstanding Balance Due' : '当前未结清欠款'} 
                      value={statementData.summary.outstanding_balance || 0} 
                      precision={2} 
                      prefix="RM " 
                      valueStyle={{ color: '#dc2626', fontWeight: '900', fontSize: 24 }} 
                    />
                  </Card>
                </Col>
              </Row>
            )}

            <Table 
              dataSource={payments}
              rowKey="id"
              scroll={{ x: 'max-content' }}
              columns={[
                { title: isEn ? 'Payment Date' : '打款/还款日期', dataIndex: 'payment_date', render: (d: string) => <Text strong>{d}</Text> },
                { title: labels.colCompany, dataIndex: 'company_name', render: (t: string) => <Text strong>{t}</Text> },
                { 
                  title: isEn ? 'Amount Paid (RM)' : '还款金额 (RM)', 
                  dataIndex: 'amount', 
                  render: (v: number) => <Text strong style={{ color: '#16a34a', fontSize: 16 }}>+ RM {(v || 0).toFixed(2)}</Text> 
                },
                { 
                  title: isEn ? 'Payment Method' : '付款方式', 
                  dataIndex: 'payment_method',
                  render: (m: string) => <Tag color="blue">{m || 'Bank Transfer'}</Tag>
                },
                { 
                  title: isEn ? 'Reference / Cheque No.' : '单据参考号 / 支票号', 
                  dataIndex: 'reference_no',
                  render: (ref: string) => ref ? <Text code>{ref}</Text> : <Text type="secondary">-</Text>
                },
                { 
                  title: isEn ? 'Allocated DOs' : '核销/关联送货单 (DO)', 
                  dataIndex: 'allocated_dos_text',
                  render: (dosStr: string) => {
                    if (!dosStr) return <Tag color="default">{isEn ? 'General Credit' : '预付款/通用核销'}</Tag>;
                    const list = dosStr.split(',').map(s => s.trim()).filter(Boolean);
                    return (
                      <div style={{ maxWidth: 240, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {list.map((doNo, idx) => (
                          <Tag key={idx} color="blue" style={{ margin: 0 }}>{doNo}</Tag>
                        ))}
                      </div>
                    );
                  }
                },
                { title: isEn ? 'Remark' : '备注说明', dataIndex: 'remark', render: (r: string) => r || '-' },
                { title: isEn ? 'Created At' : '登记时间', dataIndex: 'created_at', render: (c: string) => <Text type="secondary" style={{ fontSize: 12 }}>{c}</Text> },
                {
                  title: labels.colAction,
                  key: 'action',
                  render: (r: any) => (
                    <Popconfirm
                      title={isEn ? 'Delete this payment record?' : '确认删除此笔还款记录吗？对应客户的欠款余额将被恢复。'}
                      onConfirm={() => handleDeletePayment(r.id)}
                      okText={isEn ? 'Delete' : '确认删除'}
                      cancelText={isEn ? 'Cancel' : '取消'}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />}>
                        {isEn ? 'Delete' : '删除还款'}
                      </Button>
                    </Popconfirm>
                  )
                }
              ]}
            />
          </>
        )}

        {/* ========================================================================= */}
        {/* Tab 4: 历史 Invoice 发票库                                                */}
        {/* ========================================================================= */}
        {activeTab === '4' && (
          <>
            <Table 
              dataSource={invoices} 
              rowKey="id" 
              loading={loadingInvoices} 
              scroll={{ x: 'max-content' }}
              columns={[
                { title: labels.colInvNo, dataIndex: 'invoice_number', key: 'invoice_number', render: (t: string) => <Text strong style={{ color: '#1e40af' }}>{t}</Text> },
                { title: labels.colCompany, dataIndex: 'company_name', key: 'company_name', render: (t: string) => <div><Text strong>{t}</Text></div> },
                { title: labels.colBillingPeriod, key: 'billing_period', render: (r: any) => <Text style={{ fontSize: 13 }}>{r.start_date} ~ {r.end_date}</Text> },
                { 
                  title: labels.colDoList, 
                  key: 'do_numbers', 
                  render: (_: any, r: any) => {
                    if (!r.orders_detail || r.orders_detail.length === 0) return <Text type="secondary">-</Text>;
                    const doList = r.orders_detail.map((o: any) => o.do_number).filter(Boolean);
                    return (
                      <div style={{ maxWidth: 220, display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {doList.map((doNo: string, idx: number) => (
                          <Tag key={idx} color="blue" style={{ margin: 0 }}>{doNo}</Tag>
                        ))}
                      </div>
                    );
                  }
                },
                { title: labels.colTotalAmount, dataIndex: 'total_amount', key: 'total_amount', render: (val: number) => <Text strong style={{ color: '#dc2626', fontSize: 16 }}>RM {val.toFixed(2)}</Text> },
                { 
                  title: labels.colPaymentStatus, 
                  dataIndex: 'status', 
                  key: 'status', 
                  render: (st: string) => {
                    if (st === 'PAID') return <Tag color="green">{labels.statusPaid}</Tag>;
                    if (st === 'CANCELLED') return <Tag color="default">{isEn ? 'Cancelled (DO Released)' : '已作废 (DO已回退)'}</Tag>;
                    return <Tag color="volcano">{labels.statusUnpaid}</Tag>;
                  }
                },
                {
                  title: labels.colAction,
                  key: 'actions',
                  render: (r: any) => (
                    <Space size="middle">
                      <Button 
                        size="small" 
                        type="primary" 
                        ghost 
                        icon={<FileTextOutlined />} 
                        onClick={() => {
                          setSelectedInvoice(r);
                          setInvoiceModalVisible(true);
                        }}
                      >
                        {labels.btnPreview}
                      </Button>

                      {r.status !== 'CANCELLED' && (
                        <>
                          <Button size="small" type={r.status === 'PAID' ? 'default' : 'primary'} onClick={() => handleTogglePaymentStatus(r)}>
                            {r.status === 'PAID' ? labels.btnMarkUnpaid : labels.btnMarkPaid}
                          </Button>

                          <Popconfirm
                            title={isEn ? 'Void this invoice? Associated DOs will be released back to pending orders.' : '确认作废此发票吗？关联的 DO 将自动回退为待对账，发票记录将保留为【已作废】。'}
                            onConfirm={() => handleVoidInvoice(r)}
                            okText={isEn ? 'Confirm Void' : '确认作废'}
                            cancelText={isEn ? 'Cancel' : '取消'}
                          >
                            <Button size="small" danger type="dashed">
                              {isEn ? 'Void (Release DO)' : '作废发票 (回退DO)'}
                            </Button>
                          </Popconfirm>
                        </>
                      )}

                      {r.status === 'CANCELLED' && (
                        <Popconfirm
                          title={isEn ? 'Permanently delete this invoice record?' : '确认彻底从系统中删除此已作废的发票记录吗？'}
                          onConfirm={() => handleDeleteInvoice(r)}
                          okText={isEn ? 'Delete Permanently' : '彻底删除'}
                          cancelText={isEn ? 'Cancel' : '取消'}
                        >
                          <Button size="small" danger type="text" icon={<DeleteOutlined />}>
                            {isEn ? 'Delete Record' : '彻底删除记录'}
                          </Button>
                        </Popconfirm>
                      )}
                    </Space>
                  ),
                },
              ]}
            />
          </>
        )}

        {/* ========================================================================= */}
        {/* Tab 5: 顾客订餐数量记录                                                   */}
        {/* ========================================================================= */}
        {activeTab === '5' && (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary">
                {isEn ? 'Meal volume tracking and kitchen prep ledger for the selected customer.' : '所选客户的订餐数量盘点、餐次分布及后厨备料账簿。'}
              </Text>
              <Button 
                type="primary"
                icon={<PrinterOutlined />} 
                onClick={() => handlePrintContainer('volume-full-print-container')} 
                style={{ fontWeight: 'bold', background: '#2563eb', borderColor: '#2563eb' }}
              >
                {isEn ? 'Print Meal Volume Report' : '一键打印完整订餐数量盘点报表'}
              </Button>
            </div>

            {/* 完整打印报表容器 */}
            <div id="volume-full-print-container">
              {/* 报表抬头 (打印时呈现在纸张顶部) */}
              <div style={{ borderBottom: '2px solid #2563eb', paddingBottom: 12, marginBottom: 16 }}>
                <Row justify="space-between" align="middle">
                  <Col>
                    <Title level={3} style={{ margin: 0, color: '#2563eb', fontWeight: 900 }}>{labels.brandName}</Title>
                    <Text strong style={{ fontSize: 12 }}>MEAL VOLUME & CONSUMPTION LEDGER / 订餐数量盘点与后厨备料报表</Text>
                  </Col>
                  <Col style={{ textAlign: 'right' }}>
                    <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                      {isEn ? 'Customer:' : '客户公司:'} <Text strong>{customers.find(c => c.id === selectedCustomer)?.company_name || '全选/全部客户'}</Text>
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {isEn ? 'Print Date:' : '生成时间:'} {dayjs().format('YYYY-MM-DD HH:mm')}
                    </Text>
                  </Col>
                </Row>
              </div>

              {mealVolumeData && mealVolumeData.summary && (
                <div>
                  <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
                    <Col span={6}>
                      <Card size="small" style={{ background: '#f8fafc' }}>
                        <Statistic title={isEn ? 'Total Order Count' : '总送货天数/订单笔数'} value={mealVolumeData.summary.total_orders || 0} suffix={isEn ? 'orders' : '笔'} />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card size="small" style={{ background: '#f0fdf4' }}>
                        <Statistic title={isEn ? 'Total Meal Volume' : '累计订餐份数盘点'} value={mealVolumeData.summary.total_portions || 0} valueStyle={{ color: '#16a34a', fontWeight: 'bold' }} suffix={isEn ? 'portions' : '份'} />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card size="small" style={{ background: '#eff6ff' }}>
                        <Statistic title={isEn ? 'Avg Daily Portions' : '日均送餐份数'} value={mealVolumeData.summary.avg_daily_portions || 0} precision={1} suffix={isEn ? 'pax/day' : '份/天'} />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card size="small" style={{ background: '#fef2f2' }}>
                        <Statistic title={isEn ? 'Total Amount' : '送餐总金额估算'} value={mealVolumeData.summary.total_amount || 0} precision={2} prefix="RM " valueStyle={{ color: '#dc2626', fontWeight: 'bold' }} />
                      </Card>
                    </Col>
                  </Row>

                  {mealVolumeData.section_summary && mealVolumeData.section_summary.length > 0 && (
                    <Card size="small" title={isEn ? 'Meal Section Breakdown' : '餐次分布占比汇总'} style={{ marginBottom: 20, background: '#fafafa' }}>
                      <Space size="large" wrap>
                        {mealVolumeData.section_summary.map((sec: any, idx: number) => (
                          <div key={idx}>
                            <Text type="secondary">{translateMealSection(sec.section_name)}: </Text>
                            <Text strong style={{ color: '#2563eb' }}>{sec.total_portions} 份 </Text>
                            <Tag color="blue">{sec.percentage}%</Tag>
                          </div>
                        ))}
                      </Space>
                    </Card>
                  )}

                  {/* 3个专业分析视图 (屏幕展示用卡片标签，打印时平铺显示) */}
                  <div className="no-print" style={{ marginBottom: 20 }}>
                    <Tabs defaultActiveKey="1" type="card">
                      <Tabs.TabPane tab={<span><NumberOutlined /> {isEn ? 'By Delivery Site' : '厂区/配送分点透视'}</span>} key="1">
                        <Table 
                          dataSource={mealVolumeData.site_summary || []} 
                          rowKey="site_name"
                          pagination={false}
                          size="small"
                          columns={[
                            { title: isEn ? 'Site Name' : '分点名称', dataIndex: 'site_name', render: (t) => <Text strong>{t}</Text> },
                            { title: isEn ? 'Portions' : '送餐总份数', dataIndex: 'total_portions', render: (v) => <Text strong style={{ color: '#2563eb' }}>{v}</Text> },
                            { title: isEn ? 'Amount (RM)' : '总金额', dataIndex: 'total_amount', render: (v) => <Text>RM {(v || 0).toFixed(2)}</Text> },
                            { title: isEn ? 'Percentage' : '占比进度', dataIndex: 'percentage', render: (v) => <Progress percent={v} size="small" status="active" /> }
                          ]}
                        />
                      </Tabs.TabPane>
                      <Tabs.TabPane tab={<span><FilterOutlined /> {isEn ? 'Day-of-Week Pattern' : '周几用餐规律'}</span>} key="2">
                        <Table 
                          dataSource={mealVolumeData.weekday_summary || []} 
                          rowKey="weekday"
                          pagination={false}
                          size="small"
                          columns={[
                            { title: isEn ? 'Weekday' : '星期', dataIndex: 'weekday', render: (t) => <Tag color="geekblue">{t}</Tag> },
                            { title: isEn ? 'Portions' : '累计订餐份数', dataIndex: 'total_portions', render: (v) => <Text strong>{v}</Text> },
                            { title: isEn ? 'Orders' : '订单笔数', dataIndex: 'order_count' },
                            { title: isEn ? 'Percentage' : '占比进度', dataIndex: 'percentage', render: (v) => <Progress percent={v} size="small" strokeColor="#108ee9" /> }
                          ]}
                        />
                      </Tabs.TabPane>
                      <Tabs.TabPane tab={<span><ContainerOutlined /> {isEn ? 'Package & Item Ledger' : '后厨套餐与单品采购消耗盘点'}</span>} key="3">
                        <Table 
                          dataSource={mealVolumeData.item_summary || []} 
                          rowKey="item_name"
                          pagination={false}
                          size="small"
                          columns={[
                            { title: isEn ? 'Package/Item Name' : '套餐/单品名称', dataIndex: 'item_name', render: (t) => <Text strong>{t}</Text> },
                            { title: isEn ? 'Portions' : '消耗总份数', dataIndex: 'total_portions', render: (v) => <Text strong style={{ color: '#16a34a' }}>{v}</Text> },
                            { title: isEn ? 'Amount (RM)' : '总金额 RM', dataIndex: 'total_amount', render: (v) => <Text>RM {(v || 0).toFixed(2)}</Text> },
                            { title: isEn ? 'Percentage' : '占比', dataIndex: 'percentage', render: (v) => <Tag color="purple">{v}%</Tag> }
                          ]}
                        />
                      </Tabs.TabPane>
                    </Tabs>
                  </div>
                </div>
              )}

              <Title level={5} style={{ marginBottom: 12 }}>{isEn ? 'Daily Delivery Orders Volume Breakdown' : '每日送货 DO 数量明细记录'}</Title>
              <Table 
                className="volume-records-table"
                loading={loadingVolume}
                dataSource={mealVolumeData.records || []}
                rowKey="order_id"
                pagination={false}
                bordered
                size="small"
                columns={[
                  { title: labels.colDoNo, dataIndex: 'do_number', width: 150, render: (t: string) => <Text strong style={{ color: '#1e40af', fontSize: 12 }}>{t}</Text> },
                  { title: labels.colDate, dataIndex: 'delivery_date', width: 100 },
                  { title: labels.colCompany, dataIndex: 'company_name', width: 180 },
                  { 
                    title: isEn ? 'Shift Breakdown & Quantities' : '各餐次与套餐份数明细', 
                    key: 'breakdown',
                    render: (r: any) => (
                      <div>
                        {sortSectionBreakdown(r.section_breakdown || []).map((sec: any, idx: number) => (
                          <div key={idx} style={{ marginBottom: 3, fontSize: 12 }}>
                            <Text strong style={{ color: '#1e40af' }}>[{translateMealSection(sec.section_name)}]: </Text>
                            {sec.items.map((it: any, i2: number) => (
                              <span key={i2} style={{ marginRight: 6 }}>
                                {it.package_name} x <Text strong style={{ color: '#2563eb' }}>{it.quantity}份</Text>
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                    )
                  },
                  { title: labels.colTotalPortions, dataIndex: 'total_portions', width: 90, render: (v: number) => <Text strong style={{ color: '#16a34a', fontSize: 13 }}>{v} 份</Text> },
                  { 
                    title: isEn ? 'Variance' : '波动预警', 
                    key: 'variance_status', 
                    width: 100,
                    render: (r: any) => {
                      if (r.variance_status === 'high') return <Tag color="red" icon={<AlertOutlined />}>突增 {r.variance_pct}%</Tag>;
                      if (r.variance_status === 'low') return <Tag color="orange">突降 {r.variance_pct}%</Tag>;
                      return <Tag color="green">平稳</Tag>;
                    }
                  },
                  { title: labels.colTotalAmount, dataIndex: 'total_amount', width: 110, render: (v: number) => <Text strong style={{ fontSize: 12 }}>RM {v.toFixed(2)}</Text> },
                ]}
              />

              {/* 打印页脚 */}
              <div style={{ marginTop: 24, textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Kim Long Catering Meal Supply Order System - Official Meal Volume Report
                </Text>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. DO 详情查看 Modal (Delivery Order 送货单弹窗)                         */}
      {/* ========================================================================= */}
      <Modal
        title={
          <Space>
            <ContainerOutlined style={{ color: '#2563eb' }} />
            <Text strong style={{ fontSize: 16 }}>{isEn ? 'Delivery Order (DO) Details' : '送货单 (DO) 详细凭证'}</Text>
          </Space>
        }
        open={doModalVisible}
        onCancel={() => setDoModalVisible(false)}
        width={750}
        footer={[
          <Button key="close" onClick={() => setDoModalVisible(false)} size="large">{labels.btnClose}</Button>,
          <Button key="print" type="primary" size="large" icon={<PrinterOutlined />} onClick={() => handlePrintContainer('do-print-content')} style={{ background: '#2563eb', borderColor: '#2563eb' }}>
            {labels.btnPrint}
          </Button>
        ]}
      >
        {selectedDoDetail && (
          <div id="do-print-content" style={{ padding: '16px 20px', background: '#fff' }}>
            <div style={{ borderBottom: '2px solid #2563eb', paddingBottom: 12, marginBottom: 16 }}>
              <Row justify="space-between" align="middle">
                <Col>
                  <Title level={4} style={{ margin: 0, color: '#2563eb' }}>{labels.brandName}</Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>DELIVERY ORDER / 送货单</Text>
                </Col>
                <Col style={{ textAlign: 'right' }}>
                  <Title level={4} style={{ margin: 0 }}>{selectedDoDetail.do_number}</Title>
                  <Text type="secondary">{labels.colDate}: {selectedDoDetail.delivery_date}</Text>
                </Col>
              </Row>
            </div>

            <Card size="small" style={{ marginBottom: 16, background: '#f8fafc' }}>
              <div><Text strong style={{ fontSize: 15 }}>{selectedDoDetail.company_name}</Text></div>
              <div><Text type="secondary">Reg: {selectedDoDetail.company_reg_no || '-'}</Text></div>
            </Card>

            <Table 
              pagination={false}
              size="small"
              bordered
              dataSource={sortMealDetails(selectedDoDetail.meal_details)}
              rowKey={(_r, i) => `${i}`}
              columns={[
                { title: labels.colShift, dataIndex: 'meal_section', width: 140, render: (t) => translateMealSection(t) },
                { title: labels.colDetails, dataIndex: 'package_name', render: (t, record: any) => <div><Text strong>{t}</Text>{record.remark && <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{labels.remarkLabel}{record.remark}</Text>}</div> },
                { title: labels.colQty, dataIndex: 'quantity', width: 90, render: (v) => <Text strong style={{ color: '#2563eb' }}>{v} 份</Text> },
                { title: labels.colPrice, dataIndex: 'unit_price', width: 100, render: (v) => `RM ${v.toFixed(2)}` },
                { title: labels.colSubtotal, dataIndex: 'subtotal', width: 110, render: (v) => <Text strong>RM {v.toFixed(2)}</Text> },
              ]}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={2} align="right"><Text strong>{labels.totalPayable}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={1}><Text strong style={{ color: '#2563eb' }}>{selectedDoDetail.total_portions} 份</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={2} colSpan={2}><Text strong style={{ color: '#dc2626', fontSize: 16 }}>RM {selectedDoDetail.total_amount.toFixed(2)}</Text></Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />

            <Row gutter={24} style={{ marginTop: 40, paddingTop: 20 }}>
              <Col span={12} style={{ textAlign: 'center' }}>
                <div style={{ borderBottom: '1px dashed #94a3b8', height: 40, marginBottom: 8 }}></div>
                <Text type="secondary">{isEn ? 'Delivered By (Central Kitchen)' : '送货人 (中央厨房)'}</Text>
              </Col>
              <Col span={12} style={{ textAlign: 'center' }}>
                <div style={{ borderBottom: '1px dashed #94a3b8', height: 40, marginBottom: 8 }}></div>
                <Text type="secondary">{isEn ? 'Received By (Customer Signature)' : '客户签收 (盖章/签名)'}</Text>
              </Col>
            </Row>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* 2. 总 DO (Summary Delivery Order) 详情与预览 Modal                       */}
      {/* ========================================================================= */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 32 }}>
            <Text strong style={{ fontSize: 16 }}>{isEn ? 'Summary Delivery Order (TDO)' : '总 DO 送货单凭证 (Summary DO)'}</Text>
            <Space align="center">
              <Text type="secondary" style={{ fontSize: 13 }}>{isEn ? 'Show Prices:' : '显示金额明细:'}</Text>
              <Switch 
                checked={showPricesOnPrint} 
                onChange={(checked) => setShowPricesOnPrint(checked)}
                checkedChildren={isEn ? 'Show' : '显示'}
                unCheckedChildren={isEn ? 'Hide' : '隐藏 (隐私保密)'}
              />
            </Space>
          </div>
        }
        open={invoiceModalVisible}
        onCancel={() => setInvoiceModalVisible(false)}
        width={850}
        footer={[
          <Button key="close" onClick={() => setInvoiceModalVisible(false)} size="large">{labels.btnClose}</Button>,
          <Button key="print" type="primary" size="large" icon={<PrinterOutlined />} onClick={() => handlePrintContainer('invoice-print-content')} style={{ background: '#2563eb', borderColor: '#2563eb', fontWeight: 'bold' }}>
            {labels.btnPrint}
          </Button>
        ]}
      >
        {selectedInvoice && (() => {
          const displayDoNo = (selectedInvoice.invoice_number || '').replace(/^INV-KL-/, 'TDO-').replace(/^DO-SUM-/, 'TDO-');
          return (
            <div id="invoice-print-content" style={{ padding: '20px 30px', background: '#ffffff' }}>
              <div style={{ borderBottom: '2px solid #2563eb', paddingBottom: 16, marginBottom: 20 }}>
                <Row justify="space-between" align="middle">
                  <Col>
                    <Title level={3} style={{ margin: 0, color: '#2563eb', fontWeight: 900 }}>{labels.brandName}</Title>
                    <Text strong style={{ fontSize: 12 }}>KIM LONG CATERING MEAL SUPPLY ORDERING SYSTEM</Text>
                  </Col>
                  <Col style={{ textAlign: 'right' }}>
                    <Title level={3} style={{ margin: 0, color: '#0f172a' }}>SUMMARY DELIVERY ORDER</Title>
                    <Text type="secondary" style={{ fontWeight: 'bold', fontSize: 14 }}>{isEn ? 'Summary DO No.' : '总 DO 编号'}: {displayDoNo}</Text>
                  </Col>
                </Row>
              </div>

              <Row gutter={24} style={{ marginBottom: 20 }}>
                <Col span={showPricesOnPrint ? 12 : 24}>
                  <Card title={labels.billTo} size="small" style={{ background: '#f8fafc' }}>
                    <div><Text strong style={{ fontSize: 16 }}>{selectedInvoice.company_name}</Text></div>
                    <div><Text type="secondary">Reg No: {selectedInvoice.company_reg_no || '-'}</Text></div>
                    <div><Text type="secondary">Tax No: {selectedInvoice.tax_number || '-'}</Text></div>
                    <div><Text type="secondary">{labels.colBillingPeriod}: {selectedInvoice.start_date} ~ {selectedInvoice.end_date}</Text></div>
                  </Card>
                </Col>
                {showPricesOnPrint && (
                  <Col span={12}>
                    <Card title={labels.remittanceInfo} size="small" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                      <div><Text strong style={{ color: '#15803d' }}>Bank: {selectedInvoice.bank_name || 'CIMB BANK BERHAD'}</Text></div>
                      <div><Text strong style={{ color: '#15803d', fontSize: 16 }}>Acc: {selectedInvoice.bank_account_no || '8606211195'}</Text></div>
                      <div><Text type="secondary">Name: KIM LONG CATERING SDN. BHD.</Text></div>
                    </Card>
                  </Col>
                )}
              </Row>

              <Table
                pagination={false}
                size="small"
                bordered
                scroll={{ x: 'max-content' }}
                dataSource={
                  (selectedInvoice.orders_detail || []).flatMap((order: any) =>
                    sortMealDetails(order.meal_details || []).map((m: any, i: number) => ({
                      key: `${order.order_id}-${i}`,
                      do_number: i === 0 ? order.do_number : '',
                      delivery_date: i === 0 ? order.delivery_date : '',
                      meal_section: m.meal_section,
                      package_name: m.package_name,
                      quantity: m.quantity,
                      unit_price: m.unit_price,
                      subtotal: m.subtotal,
                      remark: m.remark,
                    }))
                  )
                }
                rowKey="key"
                columns={[
                  { 
                    title: labels.colDoNo, 
                    dataIndex: 'do_number', 
                    width: 140, 
                    align: 'center', 
                    render: (t: string) => t ? <Text strong style={{ fontSize: 12, color: '#1e40af' }}>{t}</Text> : '' 
                  },
                  { 
                    title: labels.colDate, 
                    dataIndex: 'delivery_date', 
                    width: 100, 
                    align: 'center', 
                    render: (t: string) => t ? <Text style={{ fontSize: 12 }}>{t}</Text> : '' 
                  },
                  { 
                    title: labels.colShift, 
                    dataIndex: 'meal_section', 
                    width: 110, 
                    align: 'center', 
                    render: (t: string) => <Tag color="blue">{translateMealSection(t)}</Tag> 
                  },
                  { 
                    title: labels.colDetails, 
                    dataIndex: 'package_name', 
                    render: (t, r: any) => <div><Text strong style={{ fontSize: 12 }}>{t}</Text>{r.remark ? <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{labels.remarkLabel}{r.remark}</Text> : null}</div> 
                  },
                  { 
                    title: labels.colQty, 
                    dataIndex: 'quantity', 
                    width: 80, 
                    align: 'center', 
                    render: (v) => <Text strong style={{ color: '#dc2626', fontSize: 13 }}>{v} 份</Text> 
                  },
                  ...(showPricesOnPrint ? [
                    { 
                      title: labels.colPrice, 
                      dataIndex: 'unit_price', 
                      width: 90, 
                      align: 'right' as const, 
                      render: (v: number) => <Text style={{ fontSize: 12 }}>RM {v?.toFixed(2)}</Text> 
                    },
                    { 
                      title: labels.colSubtotal, 
                      dataIndex: 'subtotal', 
                      width: 100, 
                      align: 'right' as const, 
                      render: (v: number) => <Text strong style={{ fontSize: 12, color: '#dc2626' }}>RM {v?.toFixed(2)}</Text> 
                    }
                  ] : [])
                ]}
                summary={() => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={showPricesOnPrint ? 5 : 4} align="right">
                      <Text strong style={{ fontSize: 14 }}>{showPricesOnPrint ? labels.totalPayable : labels.totalPortionsLabel}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} colSpan={showPricesOnPrint ? 2 : 1} align="center">
                      <Text strong style={{ color: '#dc2626', fontSize: 15 }}>
                        {showPricesOnPrint 
                          ? `RM ${selectedInvoice?.total_amount?.toFixed(2)}`
                          : `${(selectedInvoice?.orders_detail || []).reduce((acc: number, o: any) => acc + (o.total_portions || 0), 0)} 份`}
                      </Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />

              <Divider style={{ margin: '20px 0' }} />
              <Text type="secondary" style={{ fontSize: 12, display: 'block', textAlign: 'center' }}>
                此单据为金龙中央厨房客户总送货单 (Summary Delivery Order)，多张 DO 汇总核算凭证：{displayDoNo}。
              </Text>
            </div>
          );
        })()}
      </Modal>

      {/* ========================================================================= */}
      {/* 3. 客户 Statement 对账单 打印 Modal                                      */}
      {/* ========================================================================= */}
      <Modal
        title={<Text strong style={{ fontSize: 16 }}>{isEn ? 'Customer Statement of Account (SOA)' : '客户商业对账单 (SOA)'}</Text>}
        open={statementModalVisible}
        onCancel={() => setStatementModalVisible(false)}
        width={850}
        footer={[
          <Button key="close" onClick={() => setStatementModalVisible(false)} size="large">{labels.btnClose}</Button>,
          <Button key="print" type="primary" size="large" icon={<PrinterOutlined />} onClick={() => handlePrintContainer('soa-print-content')} style={{ background: '#15803d', borderColor: '#15803d', fontWeight: 'bold' }}>
            {labels.btnPrint}
          </Button>
        ]}
      >
        {statementData && statementData.customer && (
          <div id="soa-print-content" style={{ padding: '20px 30px', background: '#fff' }}>
            <div style={{ borderBottom: '3px solid #1e40af', paddingBottom: 16, marginBottom: 20 }}>
              <Row justify="space-between" align="middle">
                <Col>
                  <Title level={3} style={{ margin: 0, color: '#1e40af', fontWeight: 900 }}>{labels.brandName}</Title>
                  <Text strong style={{ fontSize: 12 }}>STATEMENT OF ACCOUNT / 客户账单对账汇总表</Text>
                </Col>
                <Col style={{ textAlign: 'right' }}>
                  <Title level={4} style={{ margin: 0 }}>STATEMENT</Title>
                  <Text type="secondary">{isEn ? 'Date Generated:' : '生成日期:'} {dayjs().format('YYYY-MM-DD')}</Text>
                </Col>
              </Row>
            </div>

            <Row gutter={24} style={{ marginBottom: 24 }}>
              <Col span={12}>
                <Card size="small" title={labels.billTo} style={{ background: '#f8fafc' }}>
                  <div><Text strong style={{ fontSize: 16 }}>{statementData.customer.company_name}</Text></div>
                  <div><Text type="secondary">Reg No: {statementData.customer.company_reg_no || '-'}</Text></div>
                  <div><Text type="secondary">Tax No: {statementData.customer.tax_number || '-'}</Text></div>
                  <div><Text type="secondary">Address: {statementData.customer.company_address || '-'}</Text></div>
                  <div><Text type="secondary">Contact: {statementData.customer.contact_name || '-'} ({statementData.customer.phone || '-'})</Text></div>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title={isEn ? 'Account Summary' : '对账汇总说明'} style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
                  <div><Text style={{ fontSize: 13 }}>{isEn ? 'Period DO Total:' : '本期 DO 送货总额:'} <Text strong style={{ color: '#0f172a' }}>RM {(statementData.summary.total_invoiced || 0).toFixed(2)}</Text></Text></div>
                  <div><Text style={{ fontSize: 13 }}>{isEn ? 'Period Payments Received:' : '本期已还款金额:'} <Text strong style={{ color: '#16a34a' }}>RM {(statementData.summary.paid_amount || 0).toFixed(2)}</Text></Text></div>
                  <div><Text style={{ fontSize: 13 }}>{isEn ? 'Total DO Portions:' : '送餐总份数:'} <Text strong style={{ color: '#2563eb' }}>{statementData.summary.total_portions || 0} 份</Text></Text></div>
                  <Divider style={{ margin: '6px 0' }} />
                  <div><Text style={{ fontSize: 15 }}>{isEn ? 'Current Outstanding Balance:' : '当前未结清欠款:'} <Text strong style={{ color: '#dc2626', fontSize: 18 }}>RM {(statementData.summary.outstanding_balance || 0).toFixed(2)}</Text></Text></div>
                </Card>
              </Col>
            </Row>

            {/* Statement Balance Flow 表格 */}
            <div style={{ marginBottom: 20 }}>
              <Title level={5} style={{ marginBottom: 8 }}>{isEn ? 'Statement Balance Flow' : '标准会计账单流动 (Balance Flow)'}</Title>
              <Table 
                pagination={false}
                size="small"
                bordered
                dataSource={[{ key: 1 }]}
                columns={[
                  { 
                    title: isEn ? 'Balance B/F (期初结余)' : '期初结余 (Balance B/F)', 
                    render: () => `RM ${(statementData.balance_flow?.balance_bf || 0).toFixed(2)}`, 
                    align: 'center' 
                  },
                  { 
                    title: isEn ? '+ Period DO Total' : '+ 本期 DO 送货总额', 
                    render: () => `RM ${(statementData.balance_flow?.period_invoiced || 0).toFixed(2)}`, 
                    align: 'center' 
                  },
                  { 
                    title: isEn ? '- Payments Received' : '- 本期收到还款 (Paid)', 
                    render: () => <Text style={{ color: '#16a34a', fontWeight: 'bold' }}>RM {(statementData.balance_flow?.period_paid || 0).toFixed(2)}</Text>, 
                    align: 'center' 
                  },
                  { 
                    title: isEn ? '= Balance C/F (期末欠款)' : '= 期末未结清欠款 (Balance C/F)', 
                    render: () => <Text strong style={{ color: '#dc2626', fontSize: 16 }}>RM {(statementData.balance_flow?.balance_cf || 0).toFixed(2)}</Text>, 
                    align: 'center' 
                  }
                ]}
              />
            </div>

            {statementData.terms_aging && (
              <div style={{ marginBottom: 20, padding: 12, border: '1px solid #bfdbfe', borderRadius: 8, background: '#f0f9ff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text strong style={{ color: '#1e40af' }}>
                    {isEn ? 'Credit Terms & Aging Analysis Breakdown' : `账期账龄分析 (依据客户签约 ${statementData.terms_aging.cycle_days} 天账期)`}
                  </Text>
                  {statementData.terms_aging.total_overdue.amount > 0 ? (
                    <Tag color="red" style={{ fontWeight: 'bold' }}>
                      {isEn ? `Overdue: RM ${statementData.terms_aging.total_overdue.amount.toFixed(2)}` : `逾期未还款: RM ${statementData.terms_aging.total_overdue.amount.toFixed(2)}`}
                    </Tag>
                  ) : (
                    <Tag color="green" style={{ fontWeight: 'bold' }}>{isEn ? '🟢 Healthy Aging' : '🟢 均在账期内'}</Tag>
                  )}
                </div>
                <Row style={{ textAlign: 'center' }} gutter={16}>
                  <Col span={6} style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>账期内 (未到期)</Text>
                    <div style={{ fontWeight: 'bold', color: '#16a34a', fontSize: 15 }}>RM {(statementData.terms_aging.within_terms?.amount || 0).toFixed(2)}</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>({statementData.terms_aging.within_terms?.count || 0} 笔 DO)</Text>
                  </Col>
                  <Col span={6} style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>逾期 1 - 7 天</Text>
                    <div style={{ fontWeight: 'bold', color: '#d97706', fontSize: 15 }}>RM {(statementData.terms_aging.overdue_1_7?.amount || 0).toFixed(2)}</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>({statementData.terms_aging.overdue_1_7?.count || 0} 笔 DO)</Text>
                  </Col>
                  <Col span={6} style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>逾期 8 - 14 天</Text>
                    <div style={{ fontWeight: 'bold', color: '#ea580c', fontSize: 15 }}>RM {(statementData.terms_aging.overdue_8_14?.amount || 0).toFixed(2)}</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>({statementData.terms_aging.overdue_8_14?.count || 0} 笔 DO)</Text>
                  </Col>
                  <Col span={6} style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>逾期 15 天以上</Text>
                    <div style={{ fontWeight: 'bold', color: '#dc2626', fontSize: 15 }}>
                      RM {((statementData.terms_aging.overdue_15_30?.amount || 0) + (statementData.terms_aging.overdue_over_30?.amount || 0)).toFixed(2)}
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      ({(statementData.terms_aging.overdue_15_30?.count || 0) + (statementData.terms_aging.overdue_over_30?.count || 0)} 笔 DO)
                    </Text>
                  </Col>
                </Row>
              </div>
            )}

            {statementData.aging && (
              <div style={{ marginBottom: 20, padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text strong style={{ color: '#0f172a' }}>{isEn ? 'Aging Analysis Summary' : '账期账龄分析 (Aging Breakdown)'}</Text>
                  {statementData.aging.days_over_90?.amount > 0 ? (
                    <Tag color="error" style={{ fontWeight: 'bold' }}>{isEn ? '⚠️ Severe Overdue >90 Days' : '⚠️ 存在 90 天以上严重逾期款'}</Tag>
                  ) : statementData.aging.days_61_90?.amount > 0 ? (
                    <Tag color="warning" style={{ fontWeight: 'bold' }}>{isEn ? '⚠️ Overdue >60 Days' : '⚠️ 存在 60 天以上拖欠款项'}</Tag>
                  ) : (
                    <Tag color="success" style={{ fontWeight: 'bold' }}>{isEn ? '🟢 Healthy Aging' : '🟢 账龄结构健康'}</Tag>
                  )}
                </div>
                <Row style={{ textAlign: 'center' }} gutter={16}>
                  <Col span={6} style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>0 - 30 天</Text>
                    <div style={{ fontWeight: 'bold', color: '#16a34a', fontSize: 15 }}>RM {(statementData.aging.current?.amount || 0).toFixed(2)}</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>({statementData.aging.current?.count || 0} 笔送货 DO)</Text>
                  </Col>
                  <Col span={6} style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>31 - 60 天</Text>
                    <div style={{ fontWeight: 'bold', color: '#d97706', fontSize: 15 }}>RM {(statementData.aging.days_31_60?.amount || 0).toFixed(2)}</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>({statementData.aging.days_31_60?.count || 0} 笔送货 DO)</Text>
                  </Col>
                  <Col span={6} style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>61 - 90 天</Text>
                    <div style={{ fontWeight: 'bold', color: '#ea580c', fontSize: 15 }}>RM {(statementData.aging.days_61_90?.amount || 0).toFixed(2)}</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>({statementData.aging.days_61_90?.count || 0} 笔送货 DO)</Text>
                  </Col>
                  <Col span={6} style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>90 天以上</Text>
                    <div style={{ fontWeight: 'bold', color: '#dc2626', fontSize: 15 }}>RM {(statementData.aging.days_over_90?.amount || 0).toFixed(2)}</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>({statementData.aging.days_over_90?.count || 0} 笔送货 DO)</Text>
                  </Col>
                </Row>
              </div>
            )}

            {/* 顾客打款/还款明细记录 (Payments Received Ledger) */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Title level={5} style={{ margin: 0, color: '#15803d' }}>
                  {isEn ? 'Payments Received Ledger' : '顾客打款 / 还款记录明细 (Payments Received)'}
                </Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {isEn ? 'Recorded Receipts' : '本期记录还款共'} <Text strong style={{ color: '#16a34a' }}>{(statementData.payments || []).length}</Text> 笔
                </Text>
              </div>

              <Table
                pagination={false}
                size="small"
                bordered
                dataSource={statementData.payments || []}
                rowKey="id"
                columns={[
                  { title: isEn ? 'Payment Date' : '打款/还款日期', dataIndex: 'payment_date', width: 120, render: (d: string) => <Text strong>{d}</Text> },
                  { title: isEn ? 'Method' : '付款方式', dataIndex: 'payment_method', width: 120, render: (m: string) => <Tag color="green">{m || 'Bank Transfer'}</Tag> },
                  { title: isEn ? 'Reference / Cheque No.' : '汇款单号 / 参考号', dataIndex: 'reference_no', width: 180, render: (r: string) => r ? <Text code>{r}</Text> : '-' },
                  { title: isEn ? 'Remark' : '备注', dataIndex: 'remark', render: (r: string) => r || '-' },
                  { 
                    title: isEn ? 'Amount Received (RM)' : '还款金额 (RM)', 
                    dataIndex: 'amount', 
                    width: 140, 
                    align: 'right' as const,
                    render: (v: number) => <Text strong style={{ color: '#16a34a', fontSize: 14 }}>+ RM {(v || 0).toFixed(2)}</Text> 
                  }
                ]}
                summary={() => (
                  <Table.Summary.Row style={{ background: '#f0fdf4' }}>
                    <Table.Summary.Cell index={0} colSpan={4} align="right">
                      <Text strong style={{ fontSize: 13, color: '#15803d' }}>{isEn ? 'Total Payments Received:' : '本期已收到打款/还款总计:'}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ color: '#16a34a', fontSize: 15 }}>
                        RM {(statementData.summary?.paid_amount || 0).toFixed(2)}
                      </Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
                locale={{ emptyText: isEn ? 'No payment records for this period.' : '本期暂无顾客打款/还款记录' }}
              />
            </div>

            <Title level={5}>{isEn ? 'Daily DO Delivery Details & Order Breakdown' : '每日送货 DO 详细订单明细 (Order Details)'}</Title>
            <Table 
              pagination={false}
              size="small"
              bordered
              dataSource={statementData.dos}
              rowKey="order_id"
              columns={[
                { title: labels.colDoNo, dataIndex: 'do_number', width: 140, align: 'center', render: (t) => <Text strong style={{ color: '#1e40af', fontSize: 13 }}>{t}</Text> },
                { title: labels.colDate, dataIndex: 'delivery_date', width: 100, align: 'center' },
                { 
                  title: isEn ? 'Due Date & Aging' : '约定到期日与账龄状态', 
                  key: 'due_status', 
                  width: 150, 
                  align: 'center', 
                  render: (_: any, r: any) => renderDueStatusTag(r, statementData.terms_aging?.cycle_days || 30)
                },
                { 
                  title: isEn ? 'Order Details' : '订单明细', 
                  key: 'meal_summary',
                  render: (r: any) => {
                    const sortedList = sortMealDetails(r.meal_details || []);
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {sortedList.map((m: any, idx: number) => (
                          <div 
                            key={idx} 
                            style={{ 
                              padding: '6px 0', 
                              borderBottom: idx === sortedList.length - 1 ? 'none' : '1px dashed #cbd5e1'
                            }}
                          >
                            {/* 1. 餐次 Tag + 套餐名称 */}
                            <div style={{ marginBottom: 2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                              <Tag color="blue" style={{ fontWeight: 'bold', margin: 0 }}>{translateMealSection(m.meal_section)}</Tag>
                              <Text strong style={{ fontSize: 13, color: '#0f172a' }}>{m.package_name}</Text>
                            </div>
                            
                            {/* 2. 份数 @ 单价 = 小计 */}
                            <div style={{ fontSize: 12, color: '#334155', marginTop: 2 }}>
                              {m.quantity} 份 @ <Text strong style={{ color: '#2563eb' }}>RM {m.unit_price?.toFixed(2)}</Text> = <Text strong style={{ color: '#dc2626', fontSize: 13 }}>RM {m.subtotal?.toFixed(2)}</Text>
                            </div>

                            {/* 3. 备注 (如果有) */}
                            {m.remark ? (
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                (备注 {m.remark})
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    );
                  }
                },
                { title: labels.colTotalPortions, dataIndex: 'total_portions', width: 90, align: 'center', render: (v) => <Text strong>{v} 份</Text> },
                { title: labels.colTotalAmount, dataIndex: 'amount', width: 120, align: 'center', render: (v) => <Text strong style={{ color: '#dc2626', fontSize: 14 }}>RM {v.toFixed(2)}</Text> }
              ]}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={3} align="right"><Text strong style={{ fontSize: 14 }}>{isEn ? 'Total Delivery Amount:' : '送货 DO 实发总金额:'}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="center"><Text strong style={{ color: '#2563eb', fontSize: 14 }}>{statementData.summary.total_portions} 份</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="center"><Text strong style={{ color: '#dc2626', fontSize: 16 }}>RM {(statementData.summary.total_dos_amount || 0).toFixed(2)}</Text></Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />

            {/* 双方印章与回条确认栏 */}
            <Row gutter={48} style={{ marginTop: 60, paddingTop: 20 }}>
              <Col span={12} style={{ textAlign: 'center' }}>
                <div style={{ borderBottom: '1px solid #94a3b8', height: 40, marginBottom: 8, margin: '0 20px' }}></div>
                <Text strong style={{ display: 'block' }}>{isEn ? 'Authorized Signature & Stamp' : '中央厨房财务印章与授权签署'}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>(KIM LONG CATERING MEAL SUPPLY)</Text>
              </Col>
              <Col span={12} style={{ textAlign: 'center' }}>
                <div style={{ borderBottom: '1px solid #94a3b8', height: 40, marginBottom: 8, margin: '0 20px' }}></div>
                <Text strong style={{ display: 'block' }}>{isEn ? 'Customer Reconciliation Sign-off & Stamp' : '客户对账签收回条'}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{isEn ? 'Date:' : '日期:'} ____________________</Text>
              </Col>
            </Row>

          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* 4. 登记客户还款 Modal                                                    */}
      {/* ========================================================================= */}
      <Modal
        title={
          <Space>
            <BankOutlined style={{ color: '#b45309' }} />
            <Text strong style={{ fontSize: 16 }}>{isEn ? 'Record Customer Payment' : '登记客户还款 / 打款记录'}</Text>
          </Space>
        }
        open={paymentModalVisible}
        onCancel={() => setPaymentModalVisible(false)}
        onOk={handleCreatePayment}
        okText={isEn ? 'Submit Payment' : '确认提交登记'}
        cancelText={isEn ? 'Cancel' : '取消'}
        okButtonProps={{ style: { background: '#b45309', borderColor: '#b45309', fontWeight: 'bold' } }}
      >
        <div style={{ padding: '10px 0' }}>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Text strong>{isEn ? 'Customer' : '付款客户公司'}</Text>
              <Select
                placeholder={isEn ? 'Select Customer' : '请选择客户'}
                style={{ width: '100%', marginTop: 6 }}
                value={paymentForm.customer_id || undefined}
                onChange={(val) => {
                  setPaymentForm({ ...paymentForm, customer_id: val });
                  setSelectedDoKeysForPayment([]);
                  if (val) {
                    fetchUnpaidDosForCustomer(val);
                  } else {
                    setUnpaidDos([]);
                  }
                }}
              >
                {customers.map((c) => (
                  <Option key={c.id} value={c.id}>{c.company_name}</Option>
                ))}
              </Select>
            </Col>

            {paymentForm.customer_id && (
              <Col span={24}>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text strong style={{ fontSize: 13, color: '#1e40af' }}>
                      {isEn ? 'Select DOs to Settle (Optional)' : '选择要还款/核销的送货单 DO (勾选自动算总额)'}
                    </Text>
                    <Space size="small">
                      <Button 
                        size="small" 
                        type="link" 
                        style={{ padding: 0 }}
                        onClick={() => handleUnpaidDoSelectionChange(unpaidDos.map(d => d.order_id))}
                      >
                        {isEn ? 'Select All' : '全选所有 DO'}
                      </Button>
                      <Divider type="vertical" />
                      <Button 
                        size="small" 
                        type="link" 
                        danger
                        style={{ padding: 0 }}
                        onClick={() => handleUnpaidDoSelectionChange([])}
                      >
                        {isEn ? 'Clear' : '清空勾选'}
                      </Button>
                    </Space>
                  </div>

                  <Table
                    size="small"
                    loading={loadingUnpaidDos}
                    dataSource={unpaidDos}
                    rowKey="order_id"
                    pagination={unpaidDos.length > 5 ? { pageSize: 5 } : false}
                    rowSelection={{
                      selectedRowKeys: selectedDoKeysForPayment,
                      onChange: handleUnpaidDoSelectionChange
                    }}
                    columns={[
                      { title: isEn ? 'DO No.' : '送货单号', dataIndex: 'do_number', render: (t: string) => <Text strong style={{ color: '#2563eb' }}>{t}</Text> },
                      { title: isEn ? 'Date' : '送货日期', dataIndex: 'delivery_date' },
                      { 
                        title: isEn ? 'Due Status' : '到期状态', 
                        align: 'center',
                        render: (_: any, r: any) => renderDueStatusTag(r, statementData?.terms_aging?.cycle_days || 30)
                      },
                      { title: isEn ? 'Amount (RM)' : 'DO 金额', dataIndex: 'amount', align: 'right', render: (v: number) => <Text strong style={{ color: '#dc2626' }}>RM {v.toFixed(2)}</Text> }
                    ]}
                  />
                  
                  {selectedDoKeysForPayment.length > 0 && (
                    <div style={{ marginTop: 8, textAlign: 'right', fontSize: 12 }}>
                      已选 <Text strong style={{ color: '#2563eb' }}>{selectedDoKeysForPayment.length}</Text> 笔 DO，自动核销金额: <Text strong style={{ color: '#16a34a', fontSize: 14 }}>RM {paymentForm.amount}</Text>
                    </div>
                  )}
                </div>
              </Col>
            )}

            <Col span={12}>
              <Text strong>{isEn ? 'Payment Date' : '打款/还款日期'}</Text>
              <DatePicker
                style={{ width: '100%', marginTop: 6 }}
                value={paymentForm.payment_date ? dayjs(paymentForm.payment_date) : null}
                onChange={(d) => setPaymentForm({ ...paymentForm, payment_date: d ? d.format('YYYY-MM-DD') : '' })}
              />
            </Col>

            <Col span={12}>
              <Text strong>{isEn ? 'Amount Paid (RM)' : '还款金额 (RM)'}</Text>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: '6px 11px',
                  borderRadius: 6,
                  border: '1px solid #d9d9d9',
                  fontSize: 14
                }}
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              />
            </Col>

            <Col span={12}>
              <Text strong>{isEn ? 'Payment Method' : '付款方式'}</Text>
              <Select
                style={{ width: '100%', marginTop: 6 }}
                value={paymentForm.payment_method}
                onChange={(val) => setPaymentForm({ ...paymentForm, payment_method: val })}
              >
                <Option value="Bank Transfer">Bank Transfer (银行转账)</Option>
                <Option value="Cheque">Cheque (支票)</Option>
                <Option value="Cash">Cash (现金)</Option>
                <Option value="Other">Other (其他)</Option>
              </Select>
            </Col>

            <Col span={12}>
              <Text strong>{isEn ? 'Reference / Cheque No.' : '汇款单据参考号 / 支票号'}</Text>
              <input
                type="text"
                placeholder="e.g. Ref #123456"
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: '6px 11px',
                  borderRadius: 6,
                  border: '1px solid #d9d9d9',
                  fontSize: 14
                }}
                value={paymentForm.reference_no}
                onChange={(e) => setPaymentForm({ ...paymentForm, reference_no: e.target.value })}
              />
            </Col>

            <Col span={24}>
              <Text strong>{isEn ? 'Remark' : '备注说明'}</Text>
              <input
                type="text"
                placeholder={isEn ? 'e.g. Payment for June DOs' : '例如：结清 6 月份供餐款项'}
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: '6px 11px',
                  borderRadius: 6,
                  border: '1px solid #d9d9d9',
                  fontSize: 14
                }}
                value={paymentForm.remark}
                onChange={(e) => setPaymentForm({ ...paymentForm, remark: e.target.value })}
              />
            </Col>
          </Row>
        </div>
      </Modal>
    </Card>
  );
};
