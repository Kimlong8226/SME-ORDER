import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, message, Tag, Typography } from 'antd';
import { PlusOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { axiosInstance } from '../../api/axiosInstance';

const { Title, Text } = Typography;
const { Option } = Select;

export const StaffManagement: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const labels = {
    title: isEn ? 'Staff Management' : '员工协同管理',
    adminSuffix: isEn ? '(Superadmin Admin Area)' : '(Superadmin 管理后台员工账号)',
    btnAdd: isEn ? 'Add Staff Member' : '添加协同员工',
    colUsername: isEn ? 'Username' : '用户名',
    colName: isEn ? 'Full Name' : '姓名',
    colRole: isEn ? 'Role' : '角色 (Role)',
    colStatus: isEn ? 'Status' : '状态',
    roleSuperadmin: isEn ? 'Superadmin' : '超级管理员',
    roleStaff: isEn ? 'Staff Member' : '运营员工',
    statusActive: isEn ? 'Active' : '在职/启用',
    statusDisabled: isEn ? 'Disabled' : '已禁用',
    modalTitle: isEn ? 'Add Staff Account' : '添加协同管理的员工账号',
    formUsername: isEn ? 'Login Username' : '登录用户名',
    formPassword: isEn ? 'Initial Password' : '初始登录密码',
    formFullName: isEn ? 'Full Name' : '员工姓名',
    formRole: isEn ? 'Assign Role' : '分配角色',
    placeholderUsername: isEn ? 'e.g. staff_lee' : '例如: staff_lee',
    placeholderFullName: isEn ? 'e.g. Dispatcher Lee' : '例如: 调度员小李',
    loadFailed: isEn ? 'Failed to fetch staff list' : '获取员工列表失败',
    createSuccess: isEn ? 'Staff account created successfully' : '员工账号创建成功',
    createFailed: isEn ? 'Failed to create staff account' : '创建失败',
    roleLabelStaff: isEn ? 'Catering Operations Staff (Staff)' : '协同管理员工 (Staff)',
    roleLabelAdmin: isEn ? 'Super Administrator (Superadmin)' : '超级管理员 (Superadmin)',
  };

  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

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
      await axiosInstance.post('/admin/staff', values);
      message.success(labels.createSuccess);
      setModalVisible(false);
      form.resetFields();
      fetchStaff();
    } catch (err: any) {
      message.error(err.response?.data?.detail || labels.createFailed);
    }
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
    { title: labels.colUsername, dataIndex: 'username', key: 'username', render: (text: string) => <Text bold>{text}</Text> },
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
  ];

  return (
    <Card
      title={<Title level={4} style={{ margin: 0 }}>👨‍🍳 {labels.title} {labels.adminSuffix}</Title>}
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>{labels.btnAdd}</Button>}
    >
      <Table columns={columns} dataSource={staffList} rowKey="id" loading={loading} />

      <Modal title={labels.modalTitle} open={modalVisible} onCancel={() => setModalVisible(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreateStaff}>
          <Form.Item name="username" label={labels.formUsername} rules={[{ required: true }]}>
            <Input prefix={<UserOutlined />} placeholder={labels.placeholderUsername} />
          </Form.Item>
          <Form.Item name="password" label={labels.formPassword} rules={[{ required: true }]}>
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
