import React, { useEffect, useState } from 'react';
import { App, Card, Table, Button, Modal, Form, Input, Select, Tag, Typography } from 'antd';
import { PlusOutlined, UserOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { axiosInstance } from '../../api/axiosInstance';

const { Title, Text } = Typography;
const { Option } = Select;

export const StaffManagement: React.FC = () => {
  const { message } = App.useApp();
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const labels = {
    title: isEn ? 'Staff Management' : '员工管理后台',
    adminSuffix: isEn ? '' : '',
    btnAdd: isEn ? 'Add Staff Member' : '添加协同员工',
    colUsername: isEn ? 'Username' : '用户名',
    colName: isEn ? 'Full Name' : '姓名',
    colRole: isEn ? 'Role' : '角色 (Role)',
    colStatus: isEn ? 'Status' : '状态',
    roleSuperadmin: isEn ? 'Superadmin' : '超级管理员',
    roleStaff: isEn ? 'Staff Member' : '运营员工',
    statusActive: isEn ? 'Active' : '在职/启用',
    statusDisabled: isEn ? 'Disabled' : '已禁用',
    modalTitleCreate: isEn ? 'Add Staff Account' : '添加协同管理的员工账号',
    modalTitleEdit: isEn ? 'Edit Staff Account' : '编辑员工账号',
    formUsername: isEn ? 'Login Username' : '登录用户名',
    formPassword: isEn ? 'Initial Password' : '初始登录密码',
    formPasswordEdit: isEn ? 'Login Password (Leave empty to keep unchanged)' : '登录密码 (留空则不修改)',
    formFullName: isEn ? 'Full Name' : '员工姓名',
    formRole: isEn ? 'Assign Role' : '分配角色',
    placeholderUsername: isEn ? 'e.g. staff_lee' : '例如: staff_lee',
    placeholderFullName: isEn ? 'e.g. Dispatcher Lee' : '例如: 调度员小李',
    loadFailed: isEn ? 'Failed to fetch staff list' : '获取员工列表失败',
    createSuccess: isEn ? 'Staff account created successfully' : '员工账号创建成功',
    createFailed: isEn ? 'Failed to create staff account' : '创建失败',
    updateSuccess: isEn ? 'Staff account updated successfully' : '员工账号更新成功',
    updateFailed: isEn ? 'Failed to update staff account' : '更新失败',
    deleteConfirm: isEn ? 'Are you sure you want to delete this staff member?' : '确定要删除该员工吗？',
    deleteSuccess: isEn ? 'Staff member deleted' : '员工删除成功',
    deleteFailed: isEn ? 'Failed to delete staff member' : '删除员工失败',
    colActions: isEn ? 'Actions' : '操作',
    roleLabelStaff: isEn ? 'Catering Operations Staff (Staff)' : '协同管理员工 (Staff)',
    roleLabelAdmin: isEn ? 'Super Administrator (Superadmin)' : '超级管理员 (Superadmin)',
  };

  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any | null>(null);

  const [form] = Form.useForm();

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/admin/staff');
      setStaffList(res.data || []);
    } catch (err) {
      message.error(labels.loadFailed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleCreateStaff = async (values: any) => {
    try {
      if (editingStaff) {
        await axiosInstance.put(`/admin/staff/${editingStaff.id}`, values);
        message.success(labels.updateSuccess);
      } else {
        await axiosInstance.post('/admin/staff', values);
        message.success(labels.createSuccess);
      }
      setModalVisible(false);
      fetchStaff();
    } catch (err: any) {
      message.error(err.response?.data?.detail || (editingStaff ? labels.updateFailed : labels.createFailed));
    }
  };

  const handleDeleteStaff = async (id: number) => {
    try {
      await axiosInstance.delete(`/admin/staff/${id}`);
      message.success(labels.deleteSuccess);
      fetchStaff();
    } catch (err: any) {
      message.error(err.response?.data?.detail || labels.deleteFailed);
    }
  };

  const openModal = (staff?: any) => {
    setEditingStaff(staff || null);
    if (staff) {
      form.setFieldsValue({
        username: staff.username,
        full_name: staff.full_name,
        role: staff.role,
        is_active: staff.is_active,
        password: '',
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ role: 'staff', is_active: true });
    }
    setModalVisible(true);
  };
  const translateFullName = (name: string) => {
    if (!isEn) return name;
    const map: Record<string, string> = {
      '超级管理员': 'Super Administrator',
      '调度员小李': 'Dispatcher Lee',
    };
    return map[name] || name;
  };

  const columns = [
    { title: labels.colUsername, dataIndex: 'username', key: 'username', render: (text: string) => <Text strong>{text}</Text> },
    { title: labels.colName, dataIndex: 'full_name', key: 'full_name', render: (text: string) => translateFullName(text) },
    {
      title: labels.colRole,
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => role === 'superadmin' ? <Tag color="gold">{labels.roleSuperadmin}</Tag> : <Tag color="blue">{labels.roleStaff}</Tag>
    },
    {
      title: labels.colStatus,
      dataIndex: 'is_active',
      key: 'is_active',
      render: (act: boolean) => act ? <Tag color="green">{labels.statusActive}</Tag> : <Tag color="red">{labels.statusDisabled}</Tag>
    },
    {
      title: labels.colActions,
      key: 'actions',
      render: (record: any) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="link" size="small" onClick={() => openModal(record)}>
            {isEn ? 'Edit' : '修改'}
          </Button>
          <Button type="text" danger size="small" onClick={() => {
            Modal.confirm({
              title: labels.deleteConfirm,
              onOk: () => handleDeleteStaff(record.id),
              okText: isEn ? 'Delete' : '删除',
              okButtonProps: { danger: true },
              cancelText: isEn ? 'Cancel' : '取消',
            });
          }}>
            {isEn ? 'Delete' : '删除'}
          </Button>
        </div>
      )
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{labels.title} {labels.adminSuffix}</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>{labels.btnAdd}</Button>
      </div>
      <Table columns={columns} dataSource={staffList} rowKey="id" loading={loading} scroll={{ x: 800 }} />

      <Modal title={editingStaff ? labels.modalTitleEdit : labels.modalTitleCreate} open={modalVisible} onCancel={() => setModalVisible(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreateStaff}>
          <Form.Item name="username" label={labels.formUsername} rules={[{ required: true }]}>
            <Input prefix={<UserOutlined />} placeholder={labels.placeholderUsername} disabled={!!editingStaff} />
          </Form.Item>
          <Form.Item name="password" label={editingStaff ? labels.formPasswordEdit : labels.formPassword} rules={[{ required: !editingStaff }]}>
            <Input.Password placeholder="Password" />
          </Form.Item>
          <Form.Item name="full_name" label={labels.formFullName} rules={[{ required: true }]}>
            <Input placeholder={labels.placeholderFullName} />
          </Form.Item>
          <Form.Item name="role" label={labels.formRole} initialValue="staff">
            <Select>
              <Option value="staff">{labels.roleLabelStaff}</Option>
              <Option value="superadmin">{labels.roleLabelAdmin}</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
