import React, { useEffect, useState } from 'react';
import { Alert, App, Button, Card, Col, Descriptions, Modal, Row, Space, Spin, Table, Tag, Typography } from 'antd';
import { FileTextOutlined, PrinterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { axiosInstance } from '../api/axiosInstance';

const { Text, Title } = Typography;

interface BillItem {
  id: number;
  meal_section: string;
  item_name: string;
  item_type: 'package' | 'addon';
  quantity: number;
  unit_price: number;
  subtotal: number;
  remark: string;
}

interface OrderBillData {
  order_id: number;
  do_number: string;
  delivery_date: string;
  status: string;
  site_name: string;
  order_remark: string;
  customer: {
    id: number;
    company_name: string;
    company_reg_no: string;
    tax_number: string;
    company_address: string;
    billing_cycle: string;
  };
  invoice: null | {
    id: number;
    invoice_number: string;
    payment_status: string;
    start_date: string;
    end_date: string;
  };
  items: BillItem[];
  total_amount: number;
}

interface OrderBillModalProps {
  orderId: number | null;
  open: boolean;
  onClose: () => void;
}

export const OrderBillModal: React.FC<OrderBillModalProps> = ({ orderId, open, onClose }) => {
  const { message } = App.useApp();
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const [loading, setLoading] = useState(false);
  const [bill, setBill] = useState<OrderBillData | null>(null);

  const labels = {
    title: isEn ? 'View Bill' : '查看账单',
    preview: isEn ? 'DO Bill Preview' : 'DO 账单预览',
    customer: isEn ? 'Bill To' : '客户单位',
    delivery: isEn ? 'Delivery Details' : '送餐资料',
    deliveryDate: isEn ? 'Delivery Date' : '送餐日期',
    deliverySite: isEn ? 'Delivery Site' : '送餐地点',
    orderStatus: isEn ? 'Order Status' : '订单状态',
    invoiceStatus: isEn ? 'Billing Status' : '账单状态',
    unbilled: isEn ? 'Not yet consolidated into a Summary DO' : '尚未合并至总 DO',
    formalInvoice: isEn ? 'Linked Summary DO' : '已关联总 DO',
    meal: isEn ? 'Meal' : '餐次',
    item: isEn ? 'Item' : '餐品',
    quantity: isEn ? 'Qty' : '数量',
    unitPrice: isEn ? 'Unit Price' : '单价',
    subtotal: isEn ? 'Subtotal' : '小计',
    total: isEn ? 'Total Amount' : '账单总额',
    remark: isEn ? 'Remark' : '备注',
    loadFailed: isEn ? 'Failed to load the order bill' : '读取订单账单失败',
    print: isEn ? 'Print' : '打印',
    close: isEn ? 'Close' : '关闭',
  };

  const statusLabel = (status: string) => ({
    submitted: isEn ? 'Submitted' : '已提交',
    confirmed: isEn ? 'Confirmed' : '已确认',
    in_production: isEn ? 'In Production' : '生产中',
    delivered: isEn ? 'Delivered' : '已送达',
    billed: isEn ? 'Billed' : '已核账',
    paid: isEn ? 'Paid' : '已付款',
    cancelled: isEn ? 'Cancelled' : '已取消',
  }[status] || status);

  const paymentLabel = (status: string) => ({
    unpaid: isEn ? 'Unpaid' : '未付款',
    paid: isEn ? 'Paid' : '已付款',
    overdue: isEn ? 'Overdue' : '已逾期',
    cancelled: isEn ? 'Voided' : '已作废',
  }[status] || status);

  useEffect(() => {
    if (!open || !orderId) return;
    let cancelled = false;
    setLoading(true);
    setBill(null);
    axiosInstance
      .get<OrderBillData>(`/admin/orders/${orderId}/bill`)
      .then((response) => {
        if (!cancelled) setBill(response.data);
      })
      .catch((error) => {
        if (!cancelled) message.error(error.response?.data?.detail || labels.loadFailed);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, orderId, isEn, message]);

  return (
    <Modal
      title={<><FileTextOutlined style={{ color: '#16a34a', marginRight: 8 }} />{labels.title}</>}
      open={open}
      onCancel={onClose}
      width={900}
      footer={(
        <Space>
          <Button icon={<PrinterOutlined />} disabled={!bill || loading} onClick={() => window.print()}>
            {labels.print}
          </Button>
          <Button onClick={onClose}>{labels.close}</Button>
        </Space>
      )}
      destroyOnHidden
    >
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #order-bill-print-area, #order-bill-print-area * { visibility: visible !important; }
          #order-bill-print-area {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            padding: 12mm !important;
            background: #fff !important;
          }
          #order-bill-print-area .ant-table-content { overflow: visible !important; }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>
      <Spin spinning={loading}>
        {bill && (
          <div id="order-bill-print-area" style={{ paddingTop: 8 }}>
            <div style={{ borderBottom: '2px solid #16a34a', paddingBottom: 12, marginBottom: 16 }}>
              <Row justify="space-between" align="middle" gutter={[12, 12]}>
                <Col>
                  <Title level={4} style={{ margin: 0, color: '#15803d' }}>KIM LONG CATERING SDN. BHD.</Title>
                  <Text type="secondary">{labels.preview}</Text>
                </Col>
                <Col style={{ textAlign: 'right' }}>
                  <Title level={4} style={{ margin: 0 }}>{bill.do_number}</Title>
                  <Tag color={bill.status === 'cancelled' ? 'red' : 'blue'}>{statusLabel(bill.status)}</Tag>
                </Col>
              </Row>
            </div>

            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col xs={24} md={12}>
                <Card size="small" title={labels.customer} style={{ height: '100%', background: '#f8fafc' }}>
                  <Text strong style={{ display: 'block', fontSize: 15 }}>{bill.customer.company_name}</Text>
                  <Text type="secondary" style={{ display: 'block' }}>Reg No: {bill.customer.company_reg_no || '-'}</Text>
                  <Text type="secondary" style={{ display: 'block' }}>Tax No: {bill.customer.tax_number || '-'}</Text>
                  {bill.customer.company_address && <Text type="secondary">{bill.customer.company_address}</Text>}
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card size="small" title={labels.delivery} style={{ height: '100%', background: '#f8fafc' }}>
                  <Descriptions size="small" column={1} colon={false}>
                    <Descriptions.Item label={labels.deliveryDate}>{bill.delivery_date}</Descriptions.Item>
                    <Descriptions.Item label={labels.deliverySite}>{bill.site_name || '-'}</Descriptions.Item>
                    <Descriptions.Item label={labels.orderStatus}>{statusLabel(bill.status)}</Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
            </Row>

            {bill.invoice ? (
              <Alert
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
                message={`${labels.formalInvoice}: ${bill.invoice.invoice_number}`}
                description={`${labels.invoiceStatus}: ${paymentLabel(bill.invoice.payment_status)} · ${bill.invoice.start_date} – ${bill.invoice.end_date}`}
              />
            ) : (
              <Alert type="info" showIcon style={{ marginBottom: 16 }} message={labels.unbilled} />
            )}

            <Table<BillItem>
              size="small"
              bordered
              pagination={false}
              rowKey="id"
              dataSource={bill.items}
              scroll={{ x: 720 }}
              columns={[
                { title: labels.meal, dataIndex: 'meal_section', width: 130 },
                {
                  title: labels.item,
                  dataIndex: 'item_name',
                  render: (value: string, item: BillItem) => (
                    <div>
                      <Text strong>{value}</Text>
                      {item.item_type === 'addon' && <Tag color="gold" style={{ marginLeft: 6 }}>Add-on</Tag>}
                      {item.remark && <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{labels.remark}: {item.remark}</Text>}
                    </div>
                  ),
                },
                { title: labels.quantity, dataIndex: 'quantity', width: 80, align: 'center' },
                { title: labels.unitPrice, dataIndex: 'unit_price', width: 110, align: 'right', render: (value: number) => `RM ${Number(value).toFixed(2)}` },
                { title: labels.subtotal, dataIndex: 'subtotal', width: 120, align: 'right', render: (value: number) => <Text strong>RM {Number(value).toFixed(2)}</Text> },
              ]}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={4} align="right"><Text strong>{labels.total}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <Text strong style={{ color: '#dc2626', fontSize: 16 }}>RM {Number(bill.total_amount).toFixed(2)}</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />

            {bill.order_remark && (
              <Alert type="warning" style={{ marginTop: 16 }} message={`${labels.remark}: ${bill.order_remark}`} />
            )}
          </div>
        )}
      </Spin>
    </Modal>
  );
};
