import React, { useEffect, useState } from 'react';
import { App, Card, Table, Button, Tag, Typography, Modal, Row, Col, Divider, Select, DatePicker, Form, Space, Popconfirm, Tabs } from 'antd';
import { PrinterOutlined, FileTextOutlined, PlusOutlined, CheckOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons';
import { axiosInstance } from '../../api/axiosInstance';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

export const InvoiceManagement: React.FC = () => {
  const { message } = App.useApp();
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const labels = {
    title: isEn ? 'Statements of Account & Invoices' : '客户账单',
    colInvNo: isEn ? 'Invoice No.' : '账单编号',
    colCompany: isEn ? 'Customer Company' : '客户',
    colBillingCycle: isEn ? 'Billing Cycle' : '账期',
    colTotalOrders: isEn ? 'Total Orders' : '订单数',
    colTotalAmount: isEn ? 'Total Receivable (RM)' : '总金额',
    colPaymentStatus: isEn ? 'Payment Status' : '状态',
    colAction: isEn ? 'Actions' : '操作',
    btnPreview: isEn ? 'Preview' : '预览对账单',
    ordersCount: isEn ? 'orders' : '笔',
    statusPaid: isEn ? 'Paid / Settled' : '已结清',
    statusUnpaid: isEn ? 'Pending Payment' : '待对账付款',
    btnClose: isEn ? 'Close' : '关闭',
    btnPrint: isEn ? 'Print Statement' : '一键打印对账单 (Print Invoice)',
    brandName: isEn ? 'Kim Long Catering' : '金龙中央厨房',
    billTo: isEn ? 'Bill To' : '客户付款单位 (Bill To)',
    regNo: isEn ? 'Company Reg No: ' : '公司注册号: ',
    taxNo: isEn ? 'Tax No: ' : '公司税号 (Tax No.): ',
    billingTerms: isEn ? 'Billing Terms: ' : '账期规则: ',
    remittanceInfo: isEn ? 'Remittance Info' : '收款银行资料 (Remittance Info)',
    bankName: isEn ? 'Bank Name: ' : '银行名称: ',
    bankAccount: isEn ? 'Bank Account: ' : '银行账号: ',
    accountName: isEn ? 'Account Name: KIM LONG CATERING MEAL SUPPLY' : '户名: KIM LONG CATERING MEAL SUPPLY',
    colDoNo: isEn ? 'DO No.' : 'DO 号',
    colDate: isEn ? 'Date' : '日期',
    colShift: isEn ? 'Shift' : '餐次',
    colDetails: isEn ? 'Package Details' : '套餐内容',
    colQty: isEn ? 'Qty' : '份数',
    colPrice: isEn ? 'Unit Price (RM)' : '单价 (RM)',
    colSubtotal: isEn ? 'Subtotal (RM)' : '小计 (RM)',
    remarkLabel: isEn ? 'Remark: ' : '备注: ',
    totalPayable: isEn ? 'Total Payable' : '应付总额 Total Payable',
    footerNotice: isEn 
      ? 'Please transfer the payment to the bank account above before the due date, and write invoice number {ref} as reference. Thank you for your support!'
      : '请在账期截止日前将款项转至上述银行账户，并在转账备注填写单号 {ref}。谢谢您的支持！',
    
    // New labels for complete invoice management
    btnGenerateInvoice: isEn ? 'Generate Invoice' : '生成对账发票',
    modalGenTitle: isEn ? 'Generate Customer Invoice / Statement' : '生成客户账期对账发票',
    formCustomer: isEn ? 'Select Customer' : '选择客户',
    formDateRange: isEn ? 'Billing Date Range' : '对账日期范围',
    infoMatchingOrders: isEn ? 'Matching Unbilled Orders:' : '范围内未对账订单数：',
    infoTotalAmount: isEn ? 'Total Calculated Amount:' : '系统估算总金额：',
    confirmGenerate: isEn ? 'Generate Now' : '生成对账单',
    btnMarkPaid: isEn ? 'Confirm Settle' : '确认结清',
    btnMarkUnpaid: isEn ? 'Set Unpaid' : '设为待付',
    confirmCancelInv: isEn ? 'Are you sure you want to cancel this invoice? Orders will be released.' : '确认撤销此对账单吗？相关订单将被释放。',
    btnCancelInv: isEn ? 'Cancel' : '撤销对账单',
    btnSave: isEn ? 'Confirm' : '确认',
    btnCancel: isEn ? 'Cancel' : '取消',
    colBillingPeriod: isEn ? 'Billing Period' : '账期区间',
    colDoList: isEn ? 'Included DOs' : 'DO 号',
    includedDosInfo: isEn ? 'Included DOs:' : '包含的 DO：',
  };

  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  
  const [genForm] = Form.useForm();
  const [unbilledLoading, setUnbilledLoading] = useState(false);
  
  const [selectedOrderIds, setSelectedOrderIds] = useState<React.Key[]>([]);
  const [selectedOrdersAmount, setSelectedOrdersAmount] = useState<number>(0);
  const [unbilledOrders, setUnbilledOrders] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/admin/invoices');
      setInvoices(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await axiosInstance.get('/admin/customers');
      setCustomers(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchCustomers();
  }, []);

  const handleCustomerChange = async (val: number) => {
    setSelectedCustomer(val);
    setUnbilledLoading(true);
    setSelectedOrderIds([]);
    setSelectedOrdersAmount(0);
    try {
      const res = await axiosInstance.get('/admin/invoices/unbilled-orders', {
        params: { customer_id: val }
      });
      setUnbilledOrders(res.data.orders || []);
    } catch (err) {
      console.error(err);
      setUnbilledOrders([]);
    } finally {
      setUnbilledLoading(false);
    }
  };

  const handleGenerateSelectedInvoices = async () => {
    if (!selectedCustomer || selectedOrderIds.length === 0) return;
    try {
      await axiosInstance.post('/admin/invoices', {
        customer_id: selectedCustomer,
        order_ids: selectedOrderIds as number[]
      });
      message.success(isEn ? 'Invoice generated successfully!' : '对账发票生成成功！');
      setSelectedOrderIds([]);
      setSelectedOrdersAmount(0);
      handleCustomerChange(selectedCustomer); // refresh unbilled
      fetchInvoices(); // refresh history
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || (isEn ? 'Failed to generate invoice' : '生成对账发票失败');
      message.error(errMsg);
    }
  };

  const handleTogglePaymentStatus = async (record: any) => {
    const nextStatus = record.status === 'PAID' ? 'unpaid' : 'paid';
    try {
      await axiosInstance.put(`/admin/invoices/${record.id}/status`, { status: nextStatus });
      message.success(isEn ? 'Payment status updated' : '付款状态更新成功');
      fetchInvoices();
    } catch (err) {
      message.error(isEn ? 'Failed to update status' : '更新状态失败');
    }
  };

  const handleDeleteInvoice = async (record: any) => {
    try {
      await axiosInstance.delete(`/admin/invoices/${record.id}`);
      message.success(isEn ? 'Invoice cancelled successfully' : '对账发票已成功撤销');
      fetchInvoices();
    } catch (err) {
      message.error(isEn ? 'Failed to cancel invoice' : '撤销发票失败');
    }
  };

  const handleOpenInvoiceModal = (inv: any) => {
    setSelectedInvoice(inv);
    setModalVisible(true);
  };

  const handlePrintInvoice = () => {
    const styleId = 'inv-print-style';
    let style = document.getElementById(styleId) as HTMLStyleElement;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.innerHTML = `
      @media print {
        body * { visibility: hidden !important; }
        #invoice-print-content, #invoice-print-content * { visibility: visible !important; }
        #invoice-print-content {
          position: fixed !important;
          top: 0; left: 0;
          width: 100%;
          padding: 32px 40px !important;
          background: #fff !important;
        }
      }
    `;
    window.print();
    window.addEventListener('afterprint', () => style.remove(), { once: true });
  };

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

  const translatePackageTemplateName = (name: string) => {
    if (!isEn) return name;
    if (name.includes('饭盒') && name.includes('2菜1肉')) return 'Bento Box (2 Veg 1 Meat 1 Fruit)';
    if (name.includes('日式饭盒')) return 'Japanese Bento Box';
    if (name.includes('Buffet 自助餐')) return 'Buffet Meal';
    return name;
  };

  const columns = [
    { title: labels.colInvNo, dataIndex: 'invoice_number', key: 'invoice_number', render: (t: string) => <Text strong style={{ color: '#1e40af' }}>{t}</Text> },
    { title: labels.colCompany, dataIndex: 'company_name', key: 'company_name', render: (t: string, r: any) => <div><Text strong>{t}</Text><div><Text type="secondary" style={{ fontSize: 12 }}>Reg: {r.company_reg_no || '-'}</Text></div></div> },
    { title: labels.colBillingPeriod, key: 'billing_period', render: (r: any) => <Text style={{ fontSize: 13 }}>{r.start_date} ~ {r.end_date}</Text> },
    { title: labels.colBillingCycle, dataIndex: 'billing_cycle', key: 'billing_cycle', render: (t: string) => <Tag color="orange">{isEn ? t.replace('天一结', ' Days Cycle') : t}</Tag> },
    { title: labels.colTotalOrders, dataIndex: 'total_orders', key: 'total_orders', render: (val: number) => `${val} ${labels.ordersCount}` },
    { 
      title: labels.colDoList, 
      key: 'do_numbers', 
      render: (_: any, r: any) => {
        if (!r.orders_detail || r.orders_detail.length === 0) return <Text type="secondary">-</Text>;
        const doList = r.orders_detail.map((o: any) => o.do_number).filter(Boolean);
        if (doList.length === 0) return <Text type="secondary">-</Text>;
        return (
          <div style={{ maxWidth: 200, display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {doList.map((doNo: string, idx: number) => (
              <Tag key={idx} color="blue" style={{ margin: 0 }}>{doNo}</Tag>
            ))}
          </div>
        );
      }
    },
    { title: labels.colTotalAmount, dataIndex: 'total_amount', key: 'total_amount', render: (val: number) => <Text strong style={{ color: '#dc2626', fontSize: 16 }}>RM {val.toFixed(2)}</Text> },
    { title: labels.colPaymentStatus, dataIndex: 'status', key: 'status', render: (st: string) => st === 'PAID' ? <Tag color="green">{labels.statusPaid}</Tag> : <Tag color="volcano">{labels.statusUnpaid}</Tag> },
    {
      title: labels.colAction,
      key: 'actions',
      render: (r: any) => (
        <Space size="middle">
          <Button size="small" type="primary" ghost icon={<FileTextOutlined />} onClick={() => handleOpenInvoiceModal(r)}>
            {labels.btnPreview}
          </Button>
          <Button size="small" type={r.status === 'PAID' ? 'default' : 'primary'} onClick={() => handleTogglePaymentStatus(r)} style={{ fontWeight: '500' }}>
            {r.status === 'PAID' ? labels.btnMarkUnpaid : labels.btnMarkPaid}
          </Button>
          <Popconfirm
            title={labels.confirmCancelInv}
            onConfirm={() => handleDeleteInvoice(r)}
            okText={labels.btnSave}
            cancelText={labels.btnCancel}
          >
            <Button size="small" danger type="text" icon={<DeleteOutlined />}>
              {labels.btnCancelInv}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card 
      title={<Title level={4} style={{ margin: 0 }}>{labels.title}</Title>}
      style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
    >
      <Tabs defaultActiveKey="1" size="large" items={[
        {
          key: '1',
          label: isEn ? "Unbilled Orders" : "待对账订单",
          children: (
            <>
          <div style={{ marginBottom: 16 }}>
             <Select 
               placeholder={labels.formCustomer} 
               style={{ width: 300 }} 
               size="large"
               onChange={handleCustomerChange}
               value={selectedCustomer}
             >
               {customers.map((c) => (
                 <Option key={c.id} value={c.id}>{c.company_name} ({c.billing_cycle}天一结)</Option>
               ))}
             </Select>
          </div>
          
          <Table 
            loading={unbilledLoading}
            dataSource={unbilledOrders}
            rowKey="id"
            scroll={{ x: 'max-content' }}
            rowSelection={{
              selectedRowKeys: selectedOrderIds,
              onChange: (selectedKeys, selectedRows) => {
                setSelectedOrderIds(selectedKeys);
                const sum = selectedRows.reduce((acc, row) => acc + row.amount, 0);
                setSelectedOrdersAmount(sum);
              }
            }}
            columns={[
              { title: labels.colDoNo, dataIndex: 'id', render: (id) => <Tag color="blue">Order #{id}</Tag> },
              { title: labels.colDate, dataIndex: 'delivery_date' },
              { title: labels.colQty, dataIndex: 'portions' },
              { title: labels.colTotalAmount, dataIndex: 'amount', render: (val) => <Text strong>RM {val.toFixed(2)}</Text> }
            ]}
          />
          
          {selectedOrderIds.length > 0 && (
            <div style={{ marginTop: 16, padding: 16, background: '#f8fafc', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text style={{ fontSize: 16, marginRight: 24 }}>已选择: <Text strong style={{ color: '#16a34a' }}>{selectedOrderIds.length}</Text> 笔订单</Text>
                <Text style={{ fontSize: 16 }}>总金额: <Text strong style={{ fontSize: 20, color: '#dc2626' }}>RM {selectedOrdersAmount.toFixed(2)}</Text></Text>
              </div>
              <Button type="primary" size="large" onClick={handleGenerateSelectedInvoices} style={{ background: '#16a34a', borderColor: '#16a34a' }}>
                {labels.btnGenerateInvoice}
              </Button>
            </div>
          )}
            </>
          )
        },
        {
          key: '2',
          label: isEn ? "Statement History" : "历史对账单",
          children: (
          <Table columns={columns} dataSource={invoices} rowKey="id" loading={loading} style={{ width: '100%' }} scroll={{ x: 'max-content' }} />
          )
        }
      ]} />

      {/* 对账发票打印 Modal */}
      <Modal
        title={null}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setModalVisible(false)} size="large">{labels.btnClose}</Button>,
          <Button key="print" type="primary" size="large" icon={<PrinterOutlined />} onClick={handlePrintInvoice} style={{ background: '#dc2626', borderColor: '#dc2626', fontWeight: 'bold' }}>{labels.btnPrint}</Button>
        ]}
      >
        {selectedInvoice && (
          <div id="invoice-print-content" style={{ padding: '20px 30px', background: '#ffffff' }}>
            {/* 页眉 */}
            <div style={{ borderBottom: '2px solid #dc2626', paddingBottom: 16, marginBottom: 20 }}>
              <Row justify="space-between" align="middle">
                <Col>
                  <Title level={3} style={{ margin: 0, color: '#dc2626', fontWeight: 900 }}>{labels.brandName}</Title>
                  <Text strong style={{ fontSize: 12 }}>KIM LONG CATERING MEAL SUPPLY ORDERING SYSTEM</Text>
                </Col>
                <Col style={{ textAlign: 'right' }}>
                  <Title level={3} style={{ margin: 0, color: '#0f172a' }}>INVOICE / STATEMENT</Title>
                  <Text type="secondary">{isEn ? 'Invoice No.' : '单号'}: {selectedInvoice.invoice_number}</Text>
                </Col>
              </Row>
            </div>

            <Row gutter={24} style={{ marginBottom: 20 }}>
              <Col span={12}>
                <Card title={labels.billTo} size="small" style={{ background: '#f8fafc' }}>
                  <div><Text strong style={{ fontSize: 16 }}>{selectedInvoice.company_name}</Text></div>
                  <div><Text type="secondary">{labels.regNo}{selectedInvoice.company_reg_no || '-'}</Text></div>
                  <div><Text type="secondary">{labels.taxNo}{selectedInvoice.tax_number || '-'}</Text></div>
                  <div><Text type="secondary">{labels.billingTerms}{isEn ? selectedInvoice.billing_cycle.replace('天一结', ' Days Cycle') : selectedInvoice.billing_cycle}</Text></div>
                </Card>
              </Col>
              <Col span={12}>
                <Card title={labels.remittanceInfo} size="small" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                  <div><Text strong style={{ color: '#15803d' }}>{labels.bankName}{selectedInvoice.bank_name || 'Maybank'}</Text></div>
                  <div><Text strong style={{ color: '#15803d', fontSize: 16 }}>{labels.bankAccount}{selectedInvoice.bank_account_no || '8009182736'}</Text></div>
                  <div><Text type="secondary">{labels.accountName}</Text></div>
                </Card>
              </Col>
            </Row>

            {/* 每日 DO 订单明细表 */}
            <Table
              pagination={false}
              size="small"
              bordered
              scroll={{ x: 'max-content' }}
              dataSource={
                (selectedInvoice.orders_detail || []).flatMap((order: any) =>
                  order.meal_details.map((m: any, i: number) => ({
                    key: `${order.order_id}-${i}`,
                    do_number: i === 0 ? order.do_number : '',
                    delivery_date: i === 0 ? order.delivery_date : '',
                    total_portions: i === 0 ? order.total_portions : null,
                    meal_section: m.meal_section,
                    package_name: m.package_name,
                    quantity: m.quantity,
                    unit_price: m.unit_price,
                    subtotal: m.subtotal,
                    remark: m.remark,
                    isFirst: i === 0,
                  }))
                )
              }
              rowKey="key"
              columns={[
                {
                  title: labels.colDoNo,
                  dataIndex: 'do_number',
                  width: 160,
                  render: (text: string) => text ? <Text strong style={{ fontSize: 12, color: '#1e40af' }}>{text}</Text> : null,
                },
                {
                  title: labels.colDate,
                  dataIndex: 'delivery_date',
                  width: 110,
                  render: (text: string) => text ? <Text style={{ fontSize: 12 }}>{text}</Text> : null,
                },
                {
                  title: labels.colShift,
                  dataIndex: 'meal_section',
                  width: 100,
                  render: (text: string) => <Text style={{ fontSize: 12 }}>{translateMealSection(text)}</Text>,
                },
                {
                  title: labels.colDetails,
                  dataIndex: 'package_name',
                  render: (text: string, r: any) => (
                    <div>
                      <Text style={{ fontSize: 12 }}>{translatePackageTemplateName(text)}</Text>
                      {r.remark ? <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{labels.remarkLabel}{r.remark}</Text> : null}
                    </div>
                  ),
                },
                {
                  title: labels.colQty,
                  dataIndex: 'quantity',
                  width: 60,
                  render: (v: number) => <Text strong style={{ color: '#dc2626', fontSize: 12 }}>{v}</Text>,
                },
                {
                  title: labels.colPrice,
                  dataIndex: 'unit_price',
                  width: 90,
                  render: (v: number) => <Text style={{ fontSize: 12 }}>RM {v?.toFixed(2)}</Text>,
                },
                {
                  title: labels.colSubtotal,
                  dataIndex: 'subtotal',
                  width: 100,
                  render: (v: number) => <Text strong style={{ fontSize: 12 }}>RM {v?.toFixed(2)}</Text>,
                },
              ]}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={6} align="right">
                    <Text strong style={{ fontSize: 14 }}>{labels.totalPayable}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>
                    <Text strong style={{ color: '#dc2626', fontSize: 14 }}>RM {selectedInvoice?.total_amount?.toFixed(2)}</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />

            <Divider style={{ margin: '20px 0' }} />
            <Text type="secondary" style={{ fontSize: 12, display: 'block', textAlign: 'center' }}>
              {labels.footerNotice.replace('{ref}', selectedInvoice.invoice_number)}
            </Text>
          </div>
        )}
      </Modal>
    </Card>
  );
};
