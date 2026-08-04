import React, { useEffect, useMemo, useState } from 'react';
import { App, Card, Calendar, Badge, Modal, Button, Table, Tag, Typography, Row, Col, Select, Space } from 'antd';
import { PrinterOutlined, FilterOutlined, EnvironmentOutlined, UserOutlined, PhoneOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { axiosInstance } from '../../api/axiosInstance';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;
const { Option } = Select;

export const OrderCalendar: React.FC = () => {
  const { message } = App.useApp();
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const labels = {
    title: isEn ? 'Order Calendar & Delivery Voucher Printing' : '后台订单日历与送货签收单打印',
    btnPrintToday: isEn ? "Print Today's Delivery Slip" : '打印今日送货出库单',
    loadCalendarFailed: isEn ? 'Failed to fetch calendar data' : '获取日历数据失败',
    loadPrintFailed: isEn ? 'Failed to fetch printing data' : '获取打印数据失败',
    updateTemplateFailed: isEn ? 'Failed to update order templates' : '更新订单模板失败',
    allCustomersOption: isEn ? '🌐 All Customers Delivery Summary' : '🌐 全部顾客送货总清单',
    selectCustomerPrompt: isEn ? 'Select customer to export DO delivery voucher:' : '选择顾客导出送货签收单：',
    selectPlaceholder: isEn ? 'Select Customer' : '选择顾客',
    allDeliveriesTitle: isEn ? 'All Deliveries Summary (Sorted by Time)' : '全场送货清单 (自然时间顺序)',
    customerTitle: isEn ? 'Customer' : '顾客',
    doSlipTitle: isEn ? 'Kim Long Catering - Meal Delivery Slip' : '金龙中央厨房 - 伙食配送出库签收单',
    orderingUnit: isEn ? 'Ordering Unit: ' : '订餐单位: ',
    allClientsSummary: isEn ? 'All Clients Summary' : '全场客户汇总',
    regNo: isEn ? 'Company Reg No: ' : '公司注册号: ',
    contactPerson: isEn ? 'Contact Person: ' : '现场联系人: ',
    phone: isEn ? 'Phone Number: ' : '联系电话: ',
    totalPortionsLabel: isEn ? 'Total Portions: ' : '本单配送食物总计 (Total Portions): ',
    portionsSuffix: isEn ? ' portions' : ' 份',
    checkedBy: isEn ? 'Packed & Checked By' : '打包核对 (Checked By)',
    driver: isEn ? 'Driver' : '司机配送 (Driver)',
    chopAndReceived: isEn ? 'Client Received & Chop / Sign' : '客户接收签收章 (Received & Signed)',
    btnClose: isEn ? 'Close' : '关闭',
    btnPrintAction: isEn ? 'Print Order Delivery Voucher' : '一键调用打印机 (Print Order Delivery Voucher)',
    colCustomer: isEn ? 'Customer Company' : '客户公司',
    colSite: isEn ? 'Delivery Site' : '送餐分点 / 地点',
    colMeal: isEn ? 'Meal' : '餐次',
    colPkg: isEn ? 'Package' : '套餐内容',
    colQty: isEn ? 'Quantity (Qty)' : '预订数量',
    colRemark: isEn ? 'Remarks (Remark)' : '单项备注',
  };

  const [calendarData, setCalendarData] = useState<any>({});
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [printSummaryData, setPrintSummaryData] = useState<any>(null);

  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedFilterCustomer, setSelectedFilterCustomer] = useState<number | null>(null);

  // 生成 DO 编号：YYYYMMDD-顾客序号（两位补零），全场为 ALL
  const doNumber = (() => {
    const datePart = (printSummaryData?.target_date || selectedDate).replace(/-/g, '');
    if (!selectedFilterCustomer) return `DO: ${datePart}-ALL`;
    const idx = customers.findIndex((c) => c.id === selectedFilterCustomer);
    const seq = idx >= 0 ? String(idx + 1).padStart(2, '0') : '01';
    return `DO: ${datePart}-${seq}`;
  })();

  const fetchCustomers = async () => {
    try {
      const res = await axiosInstance.get('/admin/customers');
      setCustomers(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCalendarSummary = async () => {
    try {
      const start = dayjs().startOf('month').format('YYYY-MM-DD');
      const end = dayjs().endOf('month').add(7, 'day').format('YYYY-MM-DD');
      const res = await axiosInstance.get(`/admin/calendar-summary?start_date=${start}&end_date=${end}`);
      setCalendarData(res.data || {});
    } catch (err) {
      message.error(labels.loadCalendarFailed);
    } finally {
    }
  };

  useEffect(() => {
    fetchCalendarSummary();
    fetchCustomers();
  }, []);

  const handleOpenPrintModal = async (dateStr: string, customerId: number | null = null) => {
    setSelectedDate(dateStr);
    setSelectedFilterCustomer(customerId);
    try {
      let url = `/admin/print-daily-summary?target_date=${dateStr}`;
      if (customerId) {
        url += `&customer_id=${customerId}`;
      }
      const res = await axiosInstance.get(url);
      setPrintSummaryData(res.data);
      setPrintModalVisible(true);
    } catch (err) {
      message.error(labels.loadPrintFailed);
    }
  };

  const handleCustomerFilterChange = async (cid: number | null) => {
    setSelectedFilterCustomer(cid);
    try {
      let url = `/admin/print-daily-summary?target_date=${selectedDate}`;
      if (cid) {
        url += `&customer_id=${cid}`;
      }
      const res = await axiosInstance.get(url);
      setPrintSummaryData(res.data);
    } catch (err) {
      message.error(labels.updateTemplateFailed);
    }
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

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const cellRender = (current: Dayjs, info: { type: string }) => {
    if (info.type !== 'date') return null;
    const dateStr = current.format('YYYY-MM-DD');
    const dayData = calendarData[dateStr];

    if (!dayData) return null;

    return (
      <div
        style={{ cursor: 'pointer', height: '100%', minHeight: isMobile ? 0 : 80 }}
        onClick={(e) => {
          e.stopPropagation();
          handleOpenPrintModal(dateStr, null);
        }}
      >
        {isMobile ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: -8 }}>
            <Badge status="success" />
          </div>
        ) : (
          Object.values(dayData).map((item: any, idx: number) => (
            <div key={idx} style={{ fontSize: 11, marginBottom: 2, background: '#f0fdf4', padding: '2px 4px', borderRadius: 4, border: '1px solid #bbf7d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <Badge status="success" text={<Text style={{ fontSize: 11 }} strong>{item.company_name}: {item.total_portions}{isEn ? ' pax' : '份'}</Text>} />
            </div>
          ))
        )}
      </div>
    );
  };

  const handlePrint = () => {
    const styleId = 'ck-print-style';
    let style = document.getElementById(styleId) as HTMLStyleElement;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    const pageOrientation = selectedFilterCustomer ? 'portrait' : 'landscape';
    style.innerHTML = `
      @page { size: A4 ${pageOrientation}; margin: 8mm; }
      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #fff !important;
          overflow: visible !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body * { visibility: hidden !important; }
        #print-content, #print-content * { visibility: visible !important; }
        #print-content {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          box-sizing: border-box !important;
          overflow: visible !important;
          background: #fff !important;
        }
        #print-content .print-document-header {
          margin-bottom: 4mm !important;
          padding-bottom: 3mm !important;
        }
        #print-content .print-document-header h2 {
          font-size: 16pt !important;
          line-height: 1.2 !important;
        }
        #print-content .print-customer-card {
          margin-bottom: 3mm !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        #print-content .print-customer-card .ant-card-body { padding: 6px 8px !important; }
        #print-content .ant-table-wrapper,
        #print-content .ant-spin-nested-loading,
        #print-content .ant-spin-container,
        #print-content .ant-table,
        #print-content .ant-table-container,
        #print-content .ant-table-content {
          width: 100% !important;
          max-width: 100% !important;
          overflow: visible !important;
        }
        #print-content .ant-table-content table {
          width: 100% !important;
          min-width: 0 !important;
          table-layout: fixed !important;
        }
        #print-content .ant-table-content::-webkit-scrollbar { display: none !important; }
        #print-content col { width: auto !important; }
        #print-content th,
        #print-content td {
          padding: 4px 6px !important;
          font-size: 8.5pt !important;
          line-height: 1.2 !important;
          vertical-align: middle !important;
          white-space: normal !important;
          word-break: break-word !important;
          overflow-wrap: anywhere !important;
        }
        #print-content th { font-weight: 700 !important; }
        #print-content .ant-typography { font-size: inherit !important; white-space: normal !important; }
        #print-content .ant-tag {
          margin: 0 !important;
          padding: 0 4px !important;
          font-size: 8pt !important;
          line-height: 16px !important;
          white-space: normal !important;
        }
        #print-content.print-all-customers col:nth-child(1) { width: 18% !important; }
        #print-content.print-all-customers col:nth-child(2) { width: 25% !important; }
        #print-content.print-all-customers col:nth-child(3) { width: 12% !important; }
        #print-content.print-all-customers col:nth-child(4) { width: 23% !important; }
        #print-content.print-all-customers col:nth-child(5) { width: 9% !important; }
        #print-content.print-all-customers col:nth-child(6) { width: 13% !important; }
        #print-content.print-single-customer col:nth-child(1) { width: 28% !important; }
        #print-content.print-single-customer col:nth-child(2) { width: 15% !important; }
        #print-content.print-single-customer col:nth-child(3) { width: 30% !important; }
        #print-content.print-single-customer col:nth-child(4) { width: 10% !important; }
        #print-content.print-single-customer col:nth-child(5) { width: 17% !important; }
        #print-content thead { display: table-header-group !important; }
        #print-content tfoot { display: table-footer-group !important; }
        #print-content tr {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        #print-content .print-total,
        #print-content .print-signatures {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        #print-content .print-total { margin-top: 3mm !important; }
        #print-content .print-signatures { margin-top: 7mm !important; padding-top: 4mm !important; }
      }
    `;
    window.print();
    window.addEventListener('afterprint', () => style.remove(), { once: true });
  };

  const selectedCustomerObj = customers.find(c => c.id === selectedFilterCustomer);
  const totalPortionsSum = printSummaryData?.delivery_breakdown?.reduce((acc: number, item: any) => acc + item.quantity, 0) || 0;

  const printTableData = useMemo(() => {
    const rows = (printSummaryData?.delivery_breakdown || []).map((row: any, index: number) => ({
      ...row,
      _printKey: [row.company_name, row.site_name, row.meal_section, row.package_name, index].join('_'),
      _customerRowSpan: 1,
      _siteRowSpan: 1,
    }));

    const applyRowSpans = (keys: string[], target: '_customerRowSpan' | '_siteRowSpan') => {
      let start = 0;
      while (start < rows.length) {
        let end = start + 1;
        while (end < rows.length && keys.every((key) => rows[end][key] === rows[start][key])) end += 1;
        rows[start][target] = end - start;
        for (let index = start + 1; index < end; index += 1) rows[index][target] = 0;
        start = end;
      }
    };

    if (!selectedFilterCustomer) applyRowSpans(['company_name'], '_customerRowSpan');
    applyRowSpans(['company_name', 'site_name', 'address'], '_siteRowSpan');
    return rows;
  }, [printSummaryData, selectedFilterCustomer]);

  const tableColumns = [
    ...(!selectedFilterCustomer ? [{
      title: labels.colCustomer,
      dataIndex: 'company_name',
      width: 200,
      onCell: (record: any) => ({ rowSpan: record._customerRowSpan }),
      render: (text: any) => <Text strong style={{ whiteSpace: 'nowrap', fontSize: 14 }}>{text}</Text>
    }] : []),
    {
      title: labels.colSite,
      dataIndex: 'site_name',
      width: 200,
      onCell: (record: any) => ({ rowSpan: record._siteRowSpan }),
      render: (text: any, record: any) => (
        <div style={{ minWidth: 160 }}>
          <Text strong style={{ fontSize: 15, whiteSpace: 'nowrap', display: 'block' }}>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}><EnvironmentOutlined /> {record.address}</Text>
        </div>
      )
    },
    {
      title: labels.colMeal,
      dataIndex: 'meal_section',
      width: 160,
      render: (text: any) => <Tag color="blue" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{translateMealSection(text)}</Tag>
    },
    {
      title: labels.colPkg,
      dataIndex: 'package_name',
      width: 200,
      render: (text: any) => <Text strong style={{ fontSize: 14, whiteSpace: 'nowrap' }}>{translatePackageTemplateName(text)}</Text>
    },
    {
      title: labels.colQty,
      dataIndex: 'quantity',
      width: 120,
      render: (val: any) => <Text strong style={{ color: '#dc2626', fontSize: 17, whiteSpace: 'nowrap' }}>{val} {isEn ? 'pax' : '份'}</Text>
    },
    {
      title: labels.colRemark,
      dataIndex: 'remark',
      render: (text: any) => <Text style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{text || '-'}</Text>
    },
  ];

  return (
    <Card style={{ width: '100%', borderRadius: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{labels.title}</Title>
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => handleOpenPrintModal(selectedDate, null)}>
          {labels.btnPrintToday} ({selectedDate})
        </Button>
      </div>
      <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <Calendar fullscreen={!isMobile} cellRender={cellRender} onSelect={(date) => setSelectedDate(date.format('YYYY-MM-DD'))} />
      </div>

      {/* 订单签收单 Modal */}
      <Modal
        title={null}
        open={printModalVisible}
        onCancel={() => setPrintModalVisible(false)}
        width="90vw"
        style={{ top: 10, maxWidth: 1400 }}
        styles={{ body: { padding: 0 } }}
        footer={[
          <Button key="close" onClick={() => setPrintModalVisible(false)}>{labels.btnClose}</Button>,
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrint} style={{ background: '#dc2626', borderColor: '#dc2626', fontWeight: 'bold' }}>
            {labels.btnPrintAction}
          </Button>
        ]}
      >
        {/* 顶部筛选栏 */}
        <div style={{ padding: '16px 24px', background: '#f8fafc', borderRadius: '8px 8px 0 0', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space size="middle">
            <FilterOutlined style={{ fontSize: 16, color: '#dc2626' }} />
            <Text strong style={{ fontSize: 15 }}>{labels.selectCustomerPrompt}</Text>
            <Select
              style={{ minWidth: 380, maxWidth: '100%' }}
              popupMatchSelectWidth={false}
              size="large"
              placeholder={labels.selectPlaceholder}
              value={selectedFilterCustomer}
              onChange={handleCustomerFilterChange}
              allowClear
            >
              {customers.map((c) => (
                <Option key={c.id} value={c.id}>🏢 {c.company_name}</Option>
              ))}
            </Select>
          </Space>

          <Tag color="red" style={{ fontSize: 14, padding: '4px 12px', fontWeight: 'bold' }}>
            {selectedFilterCustomer ? `${labels.customerTitle}: ${selectedCustomerObj?.company_name}` : labels.allDeliveriesTitle}
          </Tag>
        </div>

        {/* 打印区域 */}
        {printSummaryData && (
          <div id="print-content" className={selectedFilterCustomer ? 'print-document print-single-customer' : 'print-document print-all-customers'} style={{ padding: '32px 40px', background: '#ffffff' }}>
            <div className="print-document-header" style={{ textAlign: 'center', marginBottom: 24, borderBottom: '2px solid #dc2626', paddingBottom: 16 }}>
              <Title level={2} style={{ margin: 0, color: '#dc2626', fontWeight: 900, letterSpacing: '1px' }}>
                {labels.doSlipTitle}
              </Title>
              <Text type="secondary" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginTop: 4 }}>
                KIM LONG CATERING MEAL SUPPLY ORDERING SYSTEM
              </Text>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 16 }}>Date: <Text strong style={{ fontSize: 16, color: '#0f172a' }}>{printSummaryData?.target_date ? `${dayjs(printSummaryData.target_date).format('DD-MM-YYYY')} (${dayjs(printSummaryData.target_date).format('dddd')})` : '-'}</Text></Text>
                <Text style={{ fontSize: 16 }}>{doNumber}</Text>
              </div>
            </div>

            <Card className="print-customer-card" size="small" style={{ marginBottom: 20, background: '#f8fafc', borderColor: '#cbd5e1' }}>
              <Row gutter={24} align="middle">
                <Col span={14}>
                  <div><Text strong style={{ fontSize: 16 }}>{labels.orderingUnit}{selectedFilterCustomer ? (printSummaryData?.customer_info?.company_name || selectedCustomerObj?.company_name) : labels.allClientsSummary}</Text></div>
                  {selectedFilterCustomer && printSummaryData?.customer_info?.company_reg_no && (
                    <div><Text type="secondary">{labels.regNo}{printSummaryData.customer_info.company_reg_no}</Text></div>
                  )}
                </Col>
                <Col span={10} style={{ textAlign: 'right' }}>
                  {selectedFilterCustomer && printSummaryData?.customer_info?.contact_name && (
                    <div><Text strong style={{ fontSize: 14 }}><UserOutlined /> {labels.contactPerson}{printSummaryData.customer_info.contact_name}</Text></div>
                  )}
                  {selectedFilterCustomer && printSummaryData?.customer_info?.phone && (
                    <div><Text type="secondary"><PhoneOutlined /> {labels.phone}{printSummaryData.customer_info.phone}</Text></div>
                  )}
                </Col>
              </Row>
            </Card>

            <Table
              className="print-delivery-table"
              dataSource={printTableData}
              rowKey="_printKey"
              pagination={false}
              bordered
              size="small"
              columns={tableColumns}
              style={{ width: '100%' }}
              scroll={{ x: 'max-content' }}
            />

            <div className="print-total" style={{ marginTop: 20, textAlign: 'right', paddingRight: 12 }}>
              <Text style={{ fontSize: 16 }}>{labels.totalPortionsLabel}<Text strong style={{ fontSize: 24, color: '#dc2626' }}>{totalPortionsSum}{labels.portionsSuffix}</Text></Text>
            </div>

            <div className="print-signatures" style={{ marginTop: 44, paddingTop: 24, borderTop: '1px dashed #94a3b8' }}>
              <Row gutter={32} style={{ textAlign: 'center' }}>
                <Col span={8}>
                  <div style={{ minHeight: 60, borderBottom: '1px solid #000', marginBottom: 8 }}></div>
                  <Text strong style={{ fontSize: 14 }}>{labels.checkedBy}</Text>
                </Col>
                <Col span={8}>
                  <div style={{ minHeight: 60, borderBottom: '1px solid #000', marginBottom: 8 }}></div>
                  <Text strong style={{ fontSize: 14 }}>{labels.driver}</Text>
                </Col>
                <Col span={8}>
                  <div style={{ minHeight: 60, borderBottom: '1px solid #000', marginBottom: 8 }}></div>
                  <Text strong style={{ fontSize: 14 }}>{labels.chopAndReceived}</Text>
                </Col>
              </Row>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
};
