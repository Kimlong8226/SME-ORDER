import React, { useEffect, useState } from 'react';
import { App, Card, Table, Tag, Button, Typography, Space, Modal, Divider, Row, Col } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { axiosInstance } from '../../api/axiosInstance';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

export const DeliveryOrders: React.FC = () => {
  const { message } = App.useApp();
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const labels = {
    title: isEn ? 'Delivery Orders (DO) & Billing Panel' : '送货单与对账',
    billingCycle: isEn ? 'Billing Cycle' : '结算账期',
    daysSuffix: isEn ? 'Days Cycle' : '天一结',
    colDoNo: isEn ? 'DO Number' : 'DO 号',
    colDate: isEn ? 'Delivery Date' : '日期',
    colSite: isEn ? 'Delivery Site' : '厂区',
    colDetails: isEn ? 'Meal Details (No Price)' : '餐食细节',
    colPaymentStatus: isEn ? 'Payment Status' : '付款状态',
    colCountdown: isEn ? 'Due Countdown' : '账期',
    colAction: isEn ? 'Actions' : '操作',
    btnViewDo: isEn ? 'View DO' : '查看 DO',
    statusPending: isEn ? 'Pending Delivery' : '待送货',
    statusPaid: isEn ? 'Paid' : '已付款',
    statusUnpaid: isEn ? 'Unpaid' : '未付款',
    dueNotDelivered: isEn ? 'Not Delivered' : '尚未配送',
    dueSettled: isEn ? 'Settled' : '已结清',
    dueRemaining: isEn ? 'Remaining' : '距离到期剩',
    dueDays: isEn ? 'days' : '天',
    dueOverdue: isEn ? 'Overdue by' : '已逾期',
    
    // Modal
    doSlipTitle: isEn ? 'Kim Long Catering Meal Delivery Slip' : '金龙中央厨房伙食配送单',
    supplier: isEn ? 'Supplier' : '配送单位',
    address: isEn ? 'Delivery Address' : '送餐地址',
    phone: isEn ? 'Contact No.' : '联系电话',
    receiverCompany: isEn ? 'Receiver Company' : '收货公司',
    mealCategory: isEn ? 'Meal Category' : '餐次/分类',
    mealDesc: isEn ? 'Meal Description' : '配餐套餐描述',
    quantity: isEn ? 'Quantity (Pax)' : '数量 (人份)',
    remarkTitle: isEn ? 'Delivery Order Remarks' : '送货单备注说明',
    authorizedSignatory: isEn ? 'Kim Long Catering Signatory (Authorized Signatory)' : '金龙厨房发货人 (Authorized Signatory)',
    chopAndReceived: isEn ? 'Receiver Signatory (Chop & Received By)' : '客户签收盖章 (Chop & Received By)',
    btnClose: isEn ? 'Close' : '关闭',
    btnPrint: isEn ? 'Print DO' : '打印 DO 送货单',
    unknown: isEn ? 'Unknown' : '未知',
    supplierVal: isEn ? 'Kim Long Catering' : '金龙中央厨房',
    loading: isEn ? 'Loading...' : '加载中...',
  };

  const [userInfo, setUserInfo] = useState<any>(null);
  const [customerProfile, setCustomerProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedDo, setSelectedDo] = useState<any>(null);
  const [doModalVisible, setDoModalVisible] = useState<boolean>(false);

  useEffect(() => {
    const raw = localStorage.getItem('user_info');
    if (raw) {
      const u = JSON.parse(raw);
      setUserInfo(u);
      fetchOrdersAndProfile(u.customer_id);
    }
  }, []);

  const fetchOrdersAndProfile = async (customerId: number) => {
    setLoading(true);
    try {
      // NOTE: 使用客户专用接口获取自身资料，避免调用需要管理员权限的 /admin/customers
      const resCust = await axiosInstance.get(`/orders/customer-profile/${customerId}`);
      if (resCust.data) {
        setCustomerProfile(resCust.data);
      }

      // NOTE: 使用客户专用历史接口，避免调用需要管理员权限的 /admin/all-orders
      const resOrders = await axiosInstance.get(`/orders/customer-history/${customerId}`);
      setOrders(resOrders.data || []);
    } catch (err) {
      message.error(isEn ? 'Failed to load delivery orders' : '加载送货单与账期数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 根据送餐日期和账期计算到期状态与天数
  const calculatePaymentStatus = (deliveryDateStr: string) => {
    if (!deliveryDateStr) {
      return { statusText: labels.unknown, color: 'default', dueText: labels.unknown, isOverdue: false, paidStatus: labels.unknown };
    }
    const billingDays = parseInt(customerProfile?.billing_cycle || '30', 10);
    const deliveryDate = dayjs(deliveryDateStr);
    const today = dayjs(); // 实际日期

    const dueDate = deliveryDate.add(billingDays, 'day');
    const daysDiff = dueDate.diff(today, 'day');

    const isFuture = deliveryDate.isAfter(today, 'day');
    
    if (isFuture) {
      return {
        statusText: labels.statusPending,
        color: 'blue',
        dueText: labels.dueNotDelivered,
        isOverdue: false,
        paidStatus: labels.statusUnpaid
      };
    }

    // 模拟付款状态：如果是10天前的DO，模拟为已付款，否则未付款
    const isPaid = today.diff(deliveryDate, 'day') > 10;

    if (isPaid) {
      return {
        statusText: labels.statusPaid,
        color: 'green',
        dueText: labels.dueSettled,
        isOverdue: false,
        paidStatus: labels.statusPaid
      };
    }

    if (daysDiff < 0) {
      return {
        statusText: labels.statusUnpaid,
        color: 'red',
        dueText: `${labels.dueOverdue} ${Math.abs(daysDiff)} ${labels.dueDays}`,
        isOverdue: true,
        paidStatus: labels.statusUnpaid
      };
    } else {
      return {
        statusText: labels.statusUnpaid,
        color: 'orange',
        dueText: isEn ? `${daysDiff} ${labels.dueDays} ${labels.dueRemaining}` : `${labels.dueRemaining} ${daysDiff} ${labels.dueDays}`,
        isOverdue: false,
        paidStatus: labels.statusUnpaid
      };
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

  const columns = [
    {
      title: labels.colDoNo,
      dataIndex: 'id',
      key: 'id',
      width: 140,
      render: (id: number) => <Text strong style={{ color: '#0f172a' }}>DO-KL-{1000 + id}</Text>
    },
    {
      title: labels.colDate,
      dataIndex: 'delivery_date',
      key: 'delivery_date',
      width: 130,
      render: (text: string) => <Text style={{ fontSize: 13 }}>{text}</Text>
    },
    {
      title: labels.colSite,
      dataIndex: 'site_name',
      key: 'site_name',
      width: 160,
      render: (text: string) => <Text style={{ color: '#334155', fontSize: 13 }}>{text}</Text>
    },
    {
      title: labels.colDetails,
      dataIndex: 'details',
      key: 'details',
      render: (details: any[]) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(details || []).map((d: any) => (
            <div key={d.id} style={{ fontSize: 12, color: '#475569' }}>
              <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{translateMealSection(d.meal_section)}:</span> {translatePackageTemplateName(d.package_name)} x {d.quantity}{isEn ? ' pax' : '人'}
            </div>
          ))}
        </div>
      )
    },
    {
      title: labels.colPaymentStatus,
      key: 'payment_status',
      width: 120,
      render: (_: any, record: any) => {
        const info = calculatePaymentStatus(record.delivery_date);
        return <Tag color={info.color} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4 }}>{info.statusText}</Tag>;
      }
    },
    {
      title: labels.colCountdown,
      key: 'due_countdown',
      width: 150,
      render: (_: any, record: any) => {
        const info = calculatePaymentStatus(record.delivery_date);
        return (
          <Text 
            strong={info.isOverdue} 
            style={{ 
              fontSize: 13, 
              color: info.isOverdue ? '#ef4444' : (info.statusText === labels.statusPaid ? '#10b981' : '#475569') 
            }}
          >
            {info.dueText}
          </Text>
        );
      }
    },
    {
      title: labels.colAction,
      key: 'action',
      width: 120,
      render: (_: any, record: any) => (
        <Button
          type="primary"
          ghost
          icon={<EyeOutlined />}
          size="small"
          onClick={() => {
            setSelectedDo(record);
            setDoModalVisible(true);
          }}
          style={{ borderRadius: 6 }}
        >
          {labels.btnViewDo}
        </Button>
      )
    }
  ];

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Title level={4} style={{ margin: 0 }}>{labels.title}</Title>
          <Tag color="cyan" style={{ padding: '4px 12px', borderRadius: 6, fontSize: 13 }}>
            {labels.billingCycle}: {customerProfile?.billing_cycle ? `${customerProfile.billing_cycle} ${isEn ? 'Days' : '天一结'}` : (isEn ? '30 Days' : '30天一结')}
          </Tag>
        </div>
      }
      style={{ width: '100%', borderRadius: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}
    >
      <style>{`
        @media print {
          #root {
            display: none !important;
          }
          .ant-modal-mask {
            display: none !important;
          }
          .ant-modal-wrap {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
          .ant-modal {
            top: 0 !important;
            margin: 0 auto !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
          }
          .ant-modal-content {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
          }
          .ant-modal-close,
          .ant-modal-footer {
            display: none !important;
          }
        }
      `}</style>

      <Table
        dataSource={orders}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 8 }}
        scroll={{ x: 'max-content' }}
        style={{ borderRadius: 8 }}
      />

      {/* 电子送货单 DO 弹出模态框 */}
      <Modal
        title={null}
        open={doModalVisible}
        onCancel={() => setDoModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDoModalVisible(false)} style={{ borderRadius: 6 }}>
            {labels.btnClose}
          </Button>,
          <Button key="print" type="primary" onClick={() => window.print()} style={{ borderRadius: 6 }}>
            {labels.btnPrint}
          </Button>
        ]}
        width={680}
        styles={{ body: { padding: '24px 8px' } }}
        style={{ borderRadius: 16 }}
        destroyOnHidden
      >
        {selectedDo ? (
          <div style={{ padding: '0 16px', fontFamily: 'monospace, sans-serif' }}>
            {/* DO Header */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <Title level={3} style={{ margin: 0, letterSpacing: '2px', fontWeight: 'bold' }}>DELIVERY ORDER</Title>
              <Text strong style={{ color: '#4b5563' }}>{labels.doSlipTitle}</Text>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Text><Text strong>{labels.supplier}:</Text> {labels.supplierVal}</Text>
                  <Text><Text strong>{labels.address}:</Text> Johor Bahru Industrial Zone</Text>
                  <Text><Text strong>{labels.phone}:</Text> +60 7-555 8899</Text>
                </div>
              </Col>
              <Col span={12} style={{ borderLeft: '1px dashed #cbd5e1', paddingLeft: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Text><Text strong>{labels.colDoNo}:</Text> DO-KL-{1000 + selectedDo.id}</Text>
                  <Text><Text strong>{labels.colDate}:</Text> {selectedDo.delivery_date || labels.unknown}</Text>
                  <Text>
                    <Text strong>{labels.colPaymentStatus}:</Text>{' '}
                    <span 
                      style={{ 
                        color: calculatePaymentStatus(selectedDo.delivery_date).statusText === labels.statusPaid ? '#10b981' : (calculatePaymentStatus(selectedDo.delivery_date).isOverdue ? '#ef4444' : '#e67e22'), 
                        fontWeight: 'bold' 
                      }}
                    >
                      {calculatePaymentStatus(selectedDo.delivery_date).statusText} ({calculatePaymentStatus(selectedDo.delivery_date).dueText})
                    </span>
                  </Text>
                </div>
              </Col>
            </Row>

            <Divider style={{ margin: '12px 0' }} />

            {/* DO 收货方客户信息 */}
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 20, border: '1px solid #f1f5f9' }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Text><Text strong>{labels.receiverCompany}:</Text> {customerProfile?.company_name || labels.unknown}</Text>
                </Col>
                <Col span={12}>
                  <Text><Text strong>{labels.colSite}:</Text> {selectedDo.site_name || labels.unknown}</Text>
                </Col>
              </Row>
            </div>

            {/* DO 明细表格 (不显示金额) */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 30 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #0f172a', textAlign: 'left' }}>
                  <th style={{ padding: '8px 4px', width: '30%' }}>{labels.mealCategory}</th>
                  <th style={{ padding: '8px 4px', width: '50%' }}>{labels.mealDesc}</th>
                  <th style={{ padding: '8px 4px', width: '20%', textAlign: 'right' }}>{labels.quantity}</th>
                </tr>
              </thead>
              <tbody>
                {(selectedDo.details || []).map((d: any) => (
                  <tr key={d.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 4px' }}><Text strong>{translateMealSection(d.meal_section)}</Text></td>
                    <td style={{ padding: '10px 4px' }}>{translatePackageTemplateName(d.package_name)}</td>
                    <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 'bold' }}>{d.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 订单备注 */}
            {selectedDo.remark && (
              <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: 12, borderRadius: 8, marginBottom: 30 }}>
                <Text strong style={{ color: '#b45309', display: 'block', marginBottom: 4 }}>{labels.remarkTitle}:</Text>
                <Text style={{ color: '#78350f', fontSize: 13 }}>{selectedDo.remark}</Text>
              </div>
            )}

            {/* 签收签字栏 */}
            <Row gutter={32} style={{ marginTop: 40, paddingTop: 20 }}>
              <Col span={12} style={{ textAlign: 'center' }}>
                <div style={{ width: '80%', margin: '0 auto', borderBottom: '1px solid #94a3b8', height: 40 }}></div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>{labels.authorizedSignatory}</Text>
              </Col>
              <Col span={12} style={{ textAlign: 'center' }}>
                <div style={{ width: '80%', margin: '0 auto', borderBottom: '1px solid #94a3b8', height: 40 }}></div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>{labels.chopAndReceived}</Text>
              </Col>
            </Row>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
};
