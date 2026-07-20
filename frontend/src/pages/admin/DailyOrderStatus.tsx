import React, { useEffect, useState } from 'react';
import { App, Card, Table, DatePicker, Select, Tag, Typography, Space, Button, Badge, Modal, Form, InputNumber, Input, Row, Col, Popconfirm, Divider } from 'antd';
import { ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { axiosInstance } from '../../api/axiosInstance';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;
const { Option } = Select;

// NOTE: 定义餐次与套餐分类的对应关系，用于编辑订单时过滤可选套餐
const MEAL_SECTION_CATEGORIES: Record<string, string[]> = {
  '早餐': ['早餐'],
  'Breakfast': ['早餐'],
  '早班午餐': ['饭盒', '大型供餐'],
  'Day Shift Lunch': ['饭盒', '大型供餐'],
  '早班晚餐': ['饭盒', '大型供餐'],
  'Day Shift Dinner': ['饭盒', '大型供餐'],
  '客户/顾问加餐饭盒': ['饭盒', '大型供餐'],
  'Visitor Bento': ['饭盒', '大型供餐'],
  '夜班餐食 10pm Buffet': ['Buffet'],
  'Night Shift 10pm Buffet': ['Buffet'],
  '夜班餐食 3am 宵夜': ['宵夜'],
  'Night Shift 3am Supper': ['宵夜'],
};

export const DailyOrderStatus: React.FC = () => {
  const { message } = App.useApp();
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const labels = {
    title: isEn ? 'Daily Orders Status Dashboard' : '每日订单状态看板',
    loadFailed: isEn ? 'Failed to fetch orders' : '获取订单失败',
    statusUpdated: isEn ? 'Order status updated successfully' : '订单状态已更新',
    statusUpdateFailed: isEn ? 'Failed to update order status' : '修改状态失败',
    deleteSuccess: isEn ? 'Order deleted successfully' : '订单已成功删除',
    deleteFailed: isEn ? 'Failed to delete order' : '删除订单失败',
    saveSuccess: isEn ? 'Order updated successfully!' : '后台已成功修改该订单数据！',
    saveFailed: isEn ? 'Failed to save order updates' : '保存订单修改失败',
    colOrderId: isEn ? 'Order ID' : '订单编号',
    colDeliveryDate: isEn ? 'Delivery Date' : '配送日期',
    colCustomer: isEn ? 'Customer Client' : '企业客户',
    colSite: isEn ? 'Delivery Site' : '送餐分点/工厂',
    colDetails: isEn ? 'Meal & Package Details' : '餐次与套餐明细 (Details)',
    portions: isEn ? 'portions' : '份',
    colTotalPortions: isEn ? 'Total Portions' : '总配餐份数',
    colTotalPrice: isEn ? 'Amount (RM)' : '折合金额 (RM)',
    colStatus: isEn ? 'Current Status' : '当前状态',
    colAction: isEn ? 'Admin Management' : '后台数据管理',
    btnEdit: isEn ? 'Edit' : '编辑',
    btnDelete: isEn ? 'Delete' : '删除',
    confirmDeleteTitle: isEn ? 'Confirm Delete' : '删除订单确认',
    confirmDeleteDesc: isEn ? 'Are you sure you want to delete this order?' : '确定要彻底删除该笔订单吗？',
    filterAll: isEn ? 'All Statuses' : '全状态',
    statusSubmitted: isEn ? 'Submitted' : '已提交',
    statusDelivered: isEn ? 'Delivered' : '已送达',
    statusBilled: isEn ? 'Billed' : '已核账',
    statusPaid: isEn ? 'Paid' : '已付款',
    statusCancelled: isEn ? 'Cancelled' : '取消',
    modalEditTitle: isEn ? 'Edit Order Details' : '编辑订单',
    formDeliverySite: isEn ? 'Delivery Site / Factory' : '选择送货地址/分点',
    btnSave: isEn ? 'Save Changes' : '保存修改',
    btnCancel: isEn ? 'Cancel' : '取消',
    colModalMeal: isEn ? 'Shift' : '餐次',
    colModalPkg: isEn ? 'Package Name' : '套餐名称',
    colModalQty: isEn ? 'Order Quantity' : '预订份数',
    colModalRemark: isEn ? 'Detail Remark' : '明细备注',
    btnRefresh: isEn ? 'Refresh' : '刷新数据',
  };

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 编辑订单 Modal 状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [editSiteId, setEditSiteId] = useState<number | null>(null);
  const [editDetails, setEditDetails] = useState<any[]>([]);

  const [customerSites, setCustomerSites] = useState<any[]>([]);
  const [customerPackages, setCustomerPackages] = useState<any[]>([]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let url = `/admin/all-orders?target_date=${selectedDate}`;
      const res = await axiosInstance.get(url);
      setOrders(res.data || []);
    } catch (err) {
      message.error(labels.loadFailed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [selectedDate]);

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    try {
      await axiosInstance.put(`/admin/orders/${orderId}/status?status=${newStatus}`);
      message.success(labels.statusUpdated);
      fetchOrders();
    } catch (err) {
      message.error(labels.statusUpdateFailed);
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    try {
      await axiosInstance.delete(`/admin/orders/${orderId}`);
      message.success(labels.deleteSuccess);
      fetchOrders();
    } catch (err) {
      message.error(labels.deleteFailed);
    }
  };

  const handleOpenEditModal = async (orderRecord: any) => {
    setEditingOrder(orderRecord);
    setEditSiteId(orderRecord.site_id);
    setEditDetails(orderRecord.details.map((d: any) => ({ ...d })));

    try {
      const resCusts = await axiosInstance.get('/admin/customers');
      const cur = resCusts.data.find((c: any) => c.id === orderRecord.customer_id);
      if (cur && cur.sites) {
        setCustomerSites(cur.sites);
      }

      const resPkgs = await axiosInstance.get(`/admin/customers/${orderRecord.customer_id}/packages`);
      setCustomerPackages(resPkgs.data);
    } catch (err) {
      console.error(err);
    }

    setEditModalVisible(true);
  };

  const handleDetailQtyChange = (idx: number, newQty: number) => {
    const updated = [...editDetails];
    updated[idx].quantity = newQty;
    setEditDetails(updated);
  };

  const handleDetailRemarkChange = (idx: number, newRmk: string) => {
    const updated = [...editDetails];
    updated[idx].remark = newRmk;
    setEditDetails(updated);
  };

  const handleSaveOrderEdit = async () => {
    if (!editingOrder || !editSiteId) return;

    try {
      await axiosInstance.put(`/admin/orders/${editingOrder.id}`, {
        site_id: editSiteId,
        delivery_date: editingOrder.delivery_date,
        items: editDetails.map((d: any) => ({
          meal_section_id: d.meal_section_id,
          customer_package_id: d.customer_package_id,
          quantity: d.quantity,
          remark: d.remark || ""
        }))
      });
      message.success(labels.saveSuccess);
      setEditModalVisible(false);
      fetchOrders();
    } catch (err) {
      message.error(labels.saveFailed);
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

  const filteredOrders = orders.filter((o) => statusFilter === 'all' || o.status === statusFilter);

  const columns = [
    { title: labels.colOrderId, dataIndex: 'id', key: 'id', width: 90, render: (val: number) => <Text type="secondary">#{val}</Text> },
    { title: labels.colDeliveryDate, dataIndex: 'delivery_date', key: 'delivery_date', width: 120, render: (text: string) => <Text strong>{text}</Text> },
    { title: labels.colCustomer, dataIndex: 'company_name', key: 'company_name', width: 160, render: (text: string) => <Text strong style={{ color: '#0f172a' }}>{text}</Text> },
    { title: labels.colSite, dataIndex: 'site_name', key: 'site_name', width: 150, render: (text: string) => <Tag color="geekblue">{text}</Tag> },
    {
      title: labels.colDetails,
      dataIndex: 'details',
      key: 'details',
      // NOTE: render 第一参数是 dataIndex 对应的字段值（details 数组）
      render: (details: any[]) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(details || []).map((d: any, idx: number) => (
            <div key={idx} style={{ fontSize: 13 }}>
              <Text strong>{translateMealSection(d.meal_section)}: </Text>
              <Text>{translatePackageTemplateName(d.package_name)}</Text>
              <Tag color="green" style={{ marginLeft: 6 }}>{d.quantity} {labels.portions}</Tag>
              {d.remark && <Text type="secondary" style={{ fontSize: 12 }}>({d.remark})</Text>}
            </div>
          ))}
        </div>
      )
    },
    { title: labels.colTotalPortions, dataIndex: 'total_portions', key: 'total_portions', width: 110, render: (val: number) => <Badge count={`${val} ${labels.portions}`} overflowCount={999} style={{ backgroundColor: '#dc2626' }} /> },
    { title: labels.colTotalPrice, dataIndex: 'total_price', key: 'total_price', width: 130, render: (val: number) => <Text strong style={{ color: '#dc2626' }}>RM {val.toFixed(2)}</Text> },
    {
      title: labels.colStatus,
      dataIndex: 'status',
      key: 'status',
      width: 150,
      // NOTE: 加了 dataIndex='status'，render 第一参数为 status 值，第二参数为整行 record
      render: (_: string, record: any) => (
        <Select
          value={record.status}
          style={{ width: 130 }}
          onChange={(val) => handleStatusChange(record.id, val)}
        >
          <Option value="submitted"><Tag color="blue">{labels.statusSubmitted}</Tag></Option>
          <Option value="delivered"><Tag color="green">{labels.statusDelivered}</Tag></Option>
          <Option value="billed"><Tag color="purple">{labels.statusBilled}</Tag></Option>
          <Option value="paid"><Tag color="gold">{labels.statusPaid}</Tag></Option>
          <Option value="cancelled"><Tag color="red">{labels.statusCancelled}</Tag></Option>
        </Select>
      )
    },
    {
      title: labels.colAction,
      key: 'actions',
      width: 160,
      // NOTE: 无 dataIndex 时，render 第一参数为 undefined，第二参数为整行 record
      render: (_: any, record: any) => (
        <Space size="small">
          <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => handleOpenEditModal(record)}>
            {labels.btnEdit}
          </Button>

          <Popconfirm
            title={labels.confirmDeleteTitle}
            description={labels.confirmDeleteDesc}
            onConfirm={() => handleDeleteOrder(record.id)}
            okText={labels.btnDelete}
            cancelText={labels.btnCancel}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              {labels.btnDelete}
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Title level={4} style={{ margin: 0 }}>📋 {labels.title}</Title>
          <Space>
            <DatePicker
              value={dayjs(selectedDate)}
              onChange={(d) => d && setSelectedDate(d.format('YYYY-MM-DD'))}
              allowClear={false}
            />
            <Select value={statusFilter} onChange={(val) => setStatusFilter(val)} style={{ width: 140 }}>
              <Option value="all">{labels.filterAll}</Option>
              <Option value="submitted">{labels.statusSubmitted}</Option>
              <Option value="delivered">{labels.statusDelivered}</Option>
              <Option value="billed">{labels.statusBilled}</Option>
              <Option value="paid">{labels.statusPaid}</Option>
              <Option value="cancelled">{labels.statusCancelled}</Option>
            </Select>
            <Button type="primary" icon={<ReloadOutlined />} onClick={fetchOrders}>{labels.btnRefresh}</Button>
          </Space>
        </div>
      }
    >
      <Table columns={columns} dataSource={filteredOrders} rowKey="id" loading={loading} />

      {/* 编辑订单 Modal */}
      <Modal
        title={labels.modalEditTitle}
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleSaveOrderEdit}
        okText={labels.btnSave}
        cancelText={labels.btnCancel}
        width={720}
      >
        {editingOrder && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Text strong>{labels.colCustomer}: </Text>
                <Text>{editingOrder.company_name}</Text>
              </Col>
              <Col span={12}>
                <Text strong>{labels.colDeliveryDate}: </Text>
                <Text>{editingOrder.delivery_date}</Text>
              </Col>
            </Row>

            <Form.Item label={labels.formDeliverySite} required>
              <Select value={editSiteId} onChange={(val) => setEditSiteId(val)} style={{ width: '100%' }}>
                {customerSites.map((s: any) => (
                  <Option key={s.id} value={s.id}>{s.site_name}</Option>
                ))}
              </Select>
            </Form.Item>

            <Divider />

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f0f0f0', textAlign: 'left' }}>
                  <th style={{ padding: '8px 0' }}>{labels.colModalMeal}</th>
                  <th>{labels.colModalPkg}</th>
                  <th style={{ width: 120 }}>{labels.colModalQty}</th>
                  <th>{labels.colModalRemark}</th>
                </tr>
              </thead>
              <tbody>
                {editDetails.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 0' }}>
                      <Text strong>{translateMealSection(item.meal_section)}</Text>
                    </td>
                    <td>
                      <Select
                        value={item.customer_package_id}
                        onChange={(val) => {
                          const updated = [...editDetails];
                          updated[idx].customer_package_id = val;
                          const pkg = customerPackages.find(p => p.id === val);
                          if (pkg) {
                            updated[idx].package_name = pkg.template_name;
                          }
                          setEditDetails(updated);
                        }}
                        style={{ width: '90%' }}
                      >
                        {customerPackages
                          .filter(p => MEAL_SECTION_CATEGORIES[item.meal_section]?.includes(p.category))
                          .map(p => (
                            <Option key={p.id} value={p.id}>{translatePackageTemplateName(p.template_name)}</Option>
                          ))}
                      </Select>
                    </td>
                    <td>
                      <InputNumber
                        min={0}
                        value={item.quantity}
                        onChange={(val) => handleDetailQtyChange(idx, val || 0)}
                        style={{ width: 90 }}
                      />
                    </td>
                    <td>
                      <Input
                        value={item.remark}
                        onChange={(e) => handleDetailRemarkChange(idx, e.target.value)}
                        placeholder="Remarks"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </Card>
  );
};
