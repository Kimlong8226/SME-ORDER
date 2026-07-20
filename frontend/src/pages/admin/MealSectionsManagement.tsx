import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Card, Space, Row, Col, Typography, Divider, Popconfirm, App } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, OrderedListOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { axiosInstance } from '../../api/axiosInstance';

const { Title, Text } = Typography;

export const MealSectionsManagement: React.FC = () => {
  const { message } = App.useApp();
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const labels = {
    title: isEn ? 'Meal Shifts & Schedule Management' : '餐次与排班管理',
    colName: isEn ? 'Shift Name' : '餐次名称 (如早班午餐、宵夜)',
    colSort: isEn ? 'Sort Order' : '展示排序',
    colCategories: isEn ? 'Allowed Categories' : '关联套餐分类 (逗号分隔)',
    colAction: isEn ? 'Actions' : '操作',
    btnAdd: isEn ? 'Add New Shift' : '新增餐次定义',
    btnEdit: isEn ? 'Edit' : '编辑',
    btnDelete: isEn ? 'Delete' : '删除',
    modalAddTitle: isEn ? 'Add Meal Shift' : '添加餐次',
    modalEditTitle: isEn ? 'Edit Meal Shift' : '修改餐次配置',
    formName: isEn ? 'Shift Name' : '餐次名称',
    formSort: isEn ? 'Sort Order (Ascending)' : '前端显示排序 (越小越靠前)',
    formCategories: isEn ? 'Package Categories (e.g. 饭盒,Buffet)' : '关联套餐分类 (英文逗号分隔，如: 饭盒,Buffet)',
    formCategoriesTooltip: isEn ? 'Only agreements matching these categories can be selected in this shift.' : '只有符合这些分类的客户协议套餐才能在下单页面这一栏被预订。',
    confirmDelete: isEn ? 'Are you sure you want to delete this shift?' : '确定要彻底删除该餐次定义吗？',
    saveSuccess: isEn ? 'Saved successfully!' : '餐次配置已保存！',
    deleteSuccess: isEn ? 'Deleted successfully!' : '已成功删除该餐次！',
    loadFailed: isEn ? 'Failed to load meal shifts' : '获取餐次列表数据失败'
  };

  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  
  const [form] = Form.useForm();

  const fetchSections = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/admin/meal-sections');
      setSections(res.data || []);
    } catch (err) {
      message.error(labels.loadFailed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ sort_order: 10 });
    setModalVisible(true);
  };

  const handleOpenEditModal = (record: any) => {
    setEditingItem(record);
    form.setFieldsValue({
      name: record.name,
      sort_order: record.sort_order,
      allowed_categories: record.allowed_categories
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      if (editingItem) {
        await axiosInstance.put(`/admin/meal-sections/${editingItem.id}`, vals);
      } else {
        await axiosInstance.post('/admin/meal-sections', vals);
      }
      message.success(labels.saveSuccess);
      setModalVisible(false);
      fetchSections();
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Error saving');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await axiosInstance.delete(`/admin/meal-sections/${id}`);
      message.success(labels.deleteSuccess);
      fetchSections();
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Delete failed');
    }
  };

  const columns = [
    {
      title: labels.colName,
      dataIndex: 'name',
      key: 'name',
      render: (t: string) => <Text strong style={{ color: '#0f172a' }}>{t}</Text>
    },
    {
      title: labels.colSort,
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 120,
      render: (v: number) => <Tag color="orange">{v}</Tag>
    },
    {
      title: labels.colCategories,
      dataIndex: 'allowed_categories',
      key: 'allowed_categories',
      render: (t: string) => {
        if (!t) return <Text type="secondary" italic>{isEn ? 'None (Hidden from ordering)' : '未配置分类 (下单页隐藏)'}</Text>;
        return (
          <Space size="small" wrap>
            {t.split(',').map((cat, idx) => (
              <Tag color="purple" key={idx}>{cat ? cat.trim() : cat}</Tag>
            ))}
          </Space>
        );
      }
    },
    {
      title: labels.colAction,
      key: 'action',
      width: 180,
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => handleOpenEditModal(record)}>
            {labels.btnEdit}
          </Button>
          <Popconfirm
            title={labels.confirmDelete}
            onConfirm={() => handleDelete(record.id)}
            okText={isEn ? 'Delete' : '彻底删除'}
            cancelText={isEn ? 'Cancel' : '取消'}
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
      title={<Title level={4} style={{ margin: 0 }}>⏱️ {labels.title}</Title>}
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenAddModal} style={{ borderRadius: 8, background: '#16a34a', borderColor: '#16a34a' }}>
          {labels.btnAdd}
        </Button>
      }
      style={{ borderRadius: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}
    >
      <Table
        dataSource={sections}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 12 }}
        style={{ borderRadius: 8 }}
      />

      <Modal
        title={editingItem ? labels.modalEditTitle : labels.modalAddTitle}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        destroyOnClose
        width={500}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
          <Form.Item name="name" label={labels.formName} rules={[{ required: true }]}>
            <Input placeholder="e.g. 早班早餐 / 下午茶点" />
          </Form.Item>
          <Form.Item name="sort_order" label={labels.formSort} rules={[{ required: true }]}>
            <InputNumber min={0} max={999} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item 
            name="allowed_categories" 
            label={labels.formCategories} 
            tooltip={labels.formCategoriesTooltip}
          >
            <Input placeholder="e.g. 饭盒,大型供餐" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
