import React, { useEffect, useState } from 'react';
import { App, Card, InputNumber, Button, Select, DatePicker, Tag, Typography, Alert, Space, Row, Col, Divider, Modal, Input, Badge, Empty } from 'antd';
import { PlusOutlined, MinusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { axiosInstance } from '../../api/axiosInstance';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;
const { Option } = Select;

type AddonMatrix = Record<string, Record<number, Record<number, number>>>;

export const MatrixOrder: React.FC = () => {
  const { message } = App.useApp();
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const labels = {
    title: isEn ? 'Kim Long Catering Ordering System' : '金龙伙食自助提报系统',
    subtitle: isEn ? 'Meals are dynamically displayed based on your agreement packages. To add new shifts, please contact administration.' : '依据后台给您分派的协议套餐动态显示餐品。若需新增餐次（如早餐、夜班），请联系中央厨房后台安排。',
    fastMode: isEn ? 'Fast Ordering Mode' : '快速订餐模式',
    quickFillYilian: isEn ? 'Quick Fill Yilian' : '一键易联标准',
    blockedTitle: isEn ? 'Ordering Restricted' : '订餐服务受限',
    blockedDesc: isEn ? 'Your account has overdue payment and new orders or quantity increases are paused. Existing orders may still be reduced or cancelled before the cutoff.' : '您的账号存在已到期欠款，新增订单及增加数量已暂停；在截止时间前仍可减少或取消现有订单。',
    rulesTitle: isEn ? 'Ordering & Amendment Rules' : '下单与修改规则',
    rulesDesc: isEn ? 'Next-day orders close at 6:00 PM on the previous day. If you started before 6:00 PM, complete that one submission by 6:10 PM. Same-day changes or cancellations require customer service.' : '次日配送订单须在前一天下午 6:00 前提交；若已在 6:00 前开始操作，可在 6:10 前完成本次提交。配送当天如需修改或取消，请联系客服。',
    tempAccessTitle: isEn ? 'Temporary Ordering Access' : '临时下单权限',
    reduceOnly: isEn ? 'This account is frozen. You may only reduce quantities in this existing order.' : '账户目前被冻结，本张现有订单只允许减少数量。',
    cutoffClosed: isEn ? 'This delivery date is closed. Please contact customer service.' : '该配送日期已经截止，请联系客服处理。',
    graceActive: isEn ? 'Cutoff reached. Complete this submission before the grace period expires.' : '正常截止时间已到，请在宽限期结束前完成本次提交。',
    sundayReminderTitle: isEn ? 'Sunday Routine Rest Notice' : '星期日例行休息提示',
    sundayReminderDesc: isEn ? 'Note: Based on your delivery schedule, Sunday is a rest day and no delivery is scheduled.' : '温馨提示：根据您的送餐习惯，星期日工厂安排例休无需送餐。',
    deliveryDate: isEn ? 'Select Delivery Date' : '送餐日期',
    deliverySite: isEn ? 'Select Delivery Site / Factory' : '送餐分点/工厂',
    selectSitePlaceholder: isEn ? 'Select Receiving Site' : '请选择接收工厂/厂区',
    orderPageTitle: isEn ? 'Order Page' : '下单页面',
    orderPageDesc: isEn ? 'Only showing shifts assigned to your profile by central kitchen.' : '系统仅显示后台已为您开通并配置了协议套餐的餐品类别。',
    emptyPackages: isEn ? 'No packages assigned by admin. Please contact customer service.' : '后台暂未为您分派任何协议餐食套餐，请联系系统管理员或客服安排。',
    selected: isEn ? 'Selected' : '已选',
    noOrder: isEn ? 'No Order' : '未订餐',
    orderedCount: isEn ? 'Ordered' : '已选订',
    portions: isEn ? 'portions' : '份',
    selectTemplate: isEn ? 'Select Package Template:' : '选择配餐套餐：',
    orderPax: isEn ? 'Order Pax / Portions' : '报餐人数/份数',
    extraRice: isEn ? 'Add-ons' : '附加项',
    orderSummary: isEn ? 'Order Summary' : '已选',
    clearAll: isEn ? 'Clear Selections' : '清空选择',
    emptyCartTitle: isEn ? 'Your Cart is Empty' : '购物车为空',
    emptyCartDesc: isEn ? 'Please click meal cards to add order quantities.' : '',
    defaultPkg: isEn ? 'Default Package' : '默认配餐',
    pax: isEn ? 'Pax' : '人',
    extraRiceShort: isEn ? 'Add-ons' : '附加项',
    remarkTitle: isEn ? 'Order Remarks (Preferences, etc.)' : '备注',
    remarkPlaceholder: isEn ? 'e.g. Day shift 71, Night shift 40. Extra rice 5, no coriander...' : '例: 早班71份，夜班40份。加饭 5 份，不要香菜...',
    factory: isEn ? 'Delivery Site' : '工厂/分点',
    notSpecified: isEn ? 'Not Specified' : '未指定',
    totalPax: isEn ? 'Total Order Pax' : '总人数',
    btnSubmit: isEn ? 'Confirm & Submit Order' : '确认无误，极速提交订单',
    btnLocked: isEn ? 'Account Locked, Ordering Restricted' : '账号锁定，限制下单',
    msgSuccess: isEn ? '🎉 Order submitted successfully!' : '🎉 订单提交成功！中央厨房已准备。',
    msgSelectAtLeastOne: isEn ? 'Please select at least one meal item.' : '请至少选择一份餐食并增加报餐人数',
    msgSelectSite: isEn ? 'Please select a delivery site.' : '请选择送餐工厂分点',
    msgLoadFailed: isEn ? 'Failed to load configuration.' : '加载订餐配置失败',
    msgLoadedEdit: isEn ? 'Order details successfully loaded for edit.' : '已成功载入您选择的订单数据以供修改。',
    msgQuickFillYilian: isEn ? 'Standard filled for Yilian: Breakfast 2, Lunch 2' : '已一键按【易联习惯】填充: 早餐2份 + 午餐2份',
    msgCleared: isEn ? 'Order quantities cleared.' : '报餐数量已清空',
    btnCancel: isEn ? 'Cancel' : '取消',
  };

  const translateMealSection = (name: string) => {
    if (!isEn) return name;
    const map: Record<string, string> = {
      '早餐': 'Breakfast',
      '早班午餐': 'Day Shift Lunch',
      '早班晚餐': 'Day Shift Dinner',
      '客户/顾问加餐饭盒': 'Visitor Bento',
      '夜班餐食 10pm Buffet': 'Night Shift 10pm Buffet',
      '夜班餐食 3am 宵夜': 'Night Shift 3am Supper'
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

  const [userInfo, setUserInfo] = useState<any>(null);
  const [accessStatus, setAccessStatus] = useState<any>(null);
  const [orderWindow, setOrderWindow] = useState<any>(null);
  const [editSessionId, setEditSessionId] = useState<string | null>(null);
  const [editingOrderVersion, setEditingOrderVersion] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [originalMatrixData, setOriginalMatrixData] = useState<Record<string, Record<number, number>>>({});
  const [originalMatrixAddons, setOriginalMatrixAddons] = useState<AddonMatrix>({});
  const [serverClockOffset, setServerClockOffset] = useState(0);
  const [configurationLoaded, setConfigurationLoaded] = useState(false);
  const [, setClockTick] = useState(0);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().add(1, 'day').format('YYYY-MM-DD'));
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);

  // 数据库定义的动态餐次列表
  const [dbMealSections, setDbMealSections] = useState<any[]>([]);

  // 矩阵输入数据: { [sectionName]: { [pkgId: number]: quantity: number } }
  const [matrixData, setMatrixData] = useState<Record<string, Record<number, number>>>({});

  // Add-on 数量: { [sectionName]: { [packageTemplateId]: { [customerAddonId]: quantity } } }
  const [matrixAddons, setMatrixAddons] = useState<AddonMatrix>({});

  const [remark, setRemark] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  /**
   * 获取某个餐次可用的套餐列表
   * 直接从后端为该餐次加载好（并包含默认价/协议价）的 packages 数组中返回
   */
  const getAvailablePackagesForSection = (sectionName: string) => {
    const section = dbMealSections.find(s => s.name === sectionName);
    return section ? (section.packages || []) : [];
  };

  useEffect(() => {
    const raw = localStorage.getItem('user_info');
    if (raw) {
      const u = JSON.parse(raw);
      setUserInfo(u);
      fetchCustomerProfile(u.customer_id);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(v => v + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!configurationLoaded || !userInfo?.customer_id || !selectedDate) return;
    if (editSessionId) return;
    startOrderSession(userInfo.customer_id, selectedDate);
  }, [configurationLoaded, userInfo?.customer_id, selectedDate, isEditing, editSessionId]);

  async function startOrderSession(customerId: number, deliveryDate: string) {
    try {
      const res = await axiosInstance.post(`/orders/start-session?customer_id=${customerId}`, {
        delivery_date: deliveryDate,
      });
      setOrderWindow(res.data);
      if (res.data.server_now) setServerClockOffset(new Date(res.data.server_now).getTime() - Date.now());
      setEditSessionId(res.data.edit_session_id || null);
    } catch {
      try {
        const res = await axiosInstance.get(`/orders/order-window?customer_id=${customerId}&delivery_date=${deliveryDate}`);
        setOrderWindow(res.data);
        if (res.data.server_now) setServerClockOffset(new Date(res.data.server_now).getTime() - Date.now());
        if (!isEditing) setEditSessionId(null);
      } catch {
        setOrderWindow(null);
      }
    }
  }

  const fetchCustomerProfile = async (cid: number) => {
    try {
      // 1. 获取为该顾客开通的动态餐次和对应的公共套餐
      const sectionsRequest = axiosInstance.get(`/orders/meal-sections?customer_id=${cid}`);
      const profileRequest = axiosInstance.get(`/orders/customer-profile/${cid}`);
      const resSections = await sectionsRequest;
      const sectionsList = resSections.data || [];
      setDbMealSections(sectionsList);

      // 初始化矩阵状态的结构
      const initialData: Record<string, Record<number, number>> = {};
      const initialAddons: AddonMatrix = {};
      sectionsList.forEach((s: any) => {
        initialData[s.name] = {};
        initialAddons[s.name] = {};
        (s.packages || []).forEach((p: any) => {
          initialData[s.name][p.id] = 0;
          initialAddons[s.name][p.id] = {};
          (p.addons || []).forEach((addon: any) => {
            initialAddons[s.name][p.id][addon.id] = 0;
          });
        });
      });

      // 3. 检查是否有要编辑的订单载入
      const editingRaw = localStorage.getItem('editing_order');
      if (editingRaw) {
        const order = JSON.parse(editingRaw);
        setSelectedDate(order.delivery_date);
        setSelectedSiteId(order.site_id);

        const newQuantities = { ...initialData };
        const newAddons = { ...initialAddons };

        order.details.forEach((d: any) => {
          const name = d.meal_section_name || d.meal_section;
          if (newQuantities[name] && d.customer_package_id) {
            newQuantities[name][d.customer_package_id] = d.quantity;
            const legacyRiceMatch = String(d.remark || '').match(/加白饭\s*(\d+)\s*份/);
            if (legacyRiceMatch) {
              const sectionPackage = sectionsList
                .find((section: any) => section.name === name)?.packages
                ?.find((pkg: any) => pkg.id === d.customer_package_id);
              const riceAddon = (sectionPackage?.addons || []).find((addon: any) => /白饭|米饭/.test(addon.name));
              if (riceAddon && newAddons[name][d.customer_package_id]?.[riceAddon.id] !== undefined) {
                newAddons[name][d.customer_package_id][riceAddon.id] = Number(legacyRiceMatch[1]);
              }
            }
          } else if (newAddons[name] && d.customer_addon_id) {
            const parentMatch = String(d.remark || '').match(/\[addon_for_package:(\d+)\]/);
            const parentPackageId = Number(d.parent_package_id || (parentMatch ? parentMatch[1] : 0));
            if (parentPackageId && newAddons[name][parentPackageId]?.[d.customer_addon_id] !== undefined) {
              newAddons[name][parentPackageId][d.customer_addon_id] = d.quantity;
            }
          }
        });

        setMatrixData(newQuantities);
        setMatrixAddons(newAddons);
        setOriginalMatrixData(JSON.parse(JSON.stringify(newQuantities)));
        setOriginalMatrixAddons(JSON.parse(JSON.stringify(newAddons)));
        setEditSessionId(order.edit_session_id || null);
        setEditingOrderVersion(order.version || null);
        setIsEditing(true);
        setRemark(order.remark || '');
        localStorage.removeItem('editing_order');
        message.info(labels.msgLoadedEdit);
      } else {
        setMatrixData(initialData);
        setMatrixAddons(initialAddons);
      }

      // NOTE: 使用客户专用接口获取自身资料和送货地址，避免不安全地加载所有客户列表
      const resCust = await profileRequest;
      setAccessStatus(resCust.data?.access_status || null);
      if (resCust.data?.sites) {
        setSites(resCust.data.sites);
        if (!editingRaw && resCust.data.sites.length > 0) {
          setSelectedSiteId(resCust.data.sites[0].id);
        } else if (editingRaw) {
          const order = JSON.parse(editingRaw);
          setSelectedSiteId(order.site_id);
        }
      }
      setConfigurationLoaded(true);
    } catch (err) {
      message.error(labels.msgLoadFailed);
    }
  };

  const isBlocked = accessStatus?.effective_is_blocked ?? userInfo?.is_blocked;
  const reduceOnly = Boolean(isBlocked && isEditing);
  const isYilian = userInfo?.name?.includes('易联') || userInfo?.username?.includes('yilian');

  const isSunday = dayjs(selectedDate).day() === 0;

  // 易联软件 快捷一键 2+2
  const handleQuickFillYilian = () => {
    const updatedData = { ...matrixData };
    const bPkgs = getAvailablePackagesForSection("早餐");
    const lPkgs = getAvailablePackagesForSection("早班午餐");
    if (bPkgs.length > 0) {
      if (!updatedData["早餐"]) updatedData["早餐"] = {};
      updatedData["早餐"][bPkgs[0].id] = 2;
    }
    if (lPkgs.length > 0) {
      if (!updatedData["早班午餐"]) updatedData["早班午餐"] = {};
      updatedData["早班午餐"][lPkgs[0].id] = 2;
    }
    setMatrixData(updatedData);
    setRemark(isEn ? 'Yilian Standard: Breakfast Bento 2 + Lunch Bento 2' : '易联软件标准：早餐餐盒 2份 + 午餐餐盒 2份');
    message.success(labels.msgQuickFillYilian);
  };

  // 清空选择
  const handleClearOrder = () => {
    const cleared: Record<string, Record<number, number>> = {};
    const clearedAddons: AddonMatrix = {};
    Object.keys(matrixData).forEach(sec => {
      cleared[sec] = {};
      clearedAddons[sec] = {};
      Object.keys(matrixData[sec] || {}).forEach(pkgId => {
        cleared[sec][Number(pkgId)] = 0;
        clearedAddons[sec][Number(pkgId)] = {};
        Object.keys(matrixAddons[sec]?.[Number(pkgId)] || {}).forEach(addonId => {
          clearedAddons[sec][Number(pkgId)][Number(addonId)] = 0;
        });
      });
    });
    setMatrixData(cleared);
    setMatrixAddons(clearedAddons);
    message.info(labels.msgCleared);
  };

  const handleSubmitOrder = async () => {
    if (isBlocked && !isEditing) {
      Modal.error({
        title: labels.btnLocked,
        content: labels.blockedDesc
      });
      return;
    }

    if (!selectedSiteId) {
      message.error(labels.msgSelectSite);
      return;
    }

    const items: any[] = [];
    Object.entries(matrixData).forEach(([sectionName, pkgMap]) => {
      const matchedSection = dbMealSections.find(s => s.name === sectionName);
      const actualSectionId = matchedSection ? matchedSection.id : 1;

      Object.entries(pkgMap || {}).forEach(([pkgIdStr, qty]) => {
        const pkgId = Number(pkgIdStr);
        if ((qty as number) > 0) {
          items.push({
            delivery_site_id: selectedSiteId!,
            meal_section_id: actualSectionId,
            customer_package_id: pkgId,
            quantity: qty as number,
            remark: remark || ''
          });
        }
        Object.entries(matrixAddons[sectionName]?.[pkgId] || {}).forEach(([addonId, addonQty]) => {
          if ((addonQty as number) > 0) {
            items.push({
              delivery_site_id: selectedSiteId!,
              meal_section_id: actualSectionId,
              customer_addon_id: Number(addonId),
              parent_package_id: pkgId,
              quantity: addonQty as number,
              remark: `[addon_for_package:${pkgId}]`,
            });
          }
        });
      });
    });

    if (items.length === 0) {
      message.error(labels.msgSelectAtLeastOne);
      return;
    }

    setSubmitting(true);
    try {
      await axiosInstance.post(`/orders/matrix-submit?customer_id=${userInfo.customer_id}`, {
        delivery_date: selectedDate,
        items: items,
        edit_session_id: editSessionId,
        expected_order_version: editingOrderVersion,
      });
      message.success(labels.msgSuccess);
      handleClearOrder();
      setRemark('');
      setIsEditing(false);
      setEditingOrderVersion(null);
      setOriginalMatrixData({});
      setOriginalMatrixAddons({});
      setEditSessionId(null);
      await fetchCustomerProfile(userInfo.customer_id);
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  // 计算总份数
  const totalPortions = Object.values(matrixData).reduce((sum, pkgMap) => {
    const sectionSum = Object.values(pkgMap || {}).reduce((s, q) => s + (q || 0), 0);
    return sum + sectionSum;
  }, 0);

  // 获取购物车已选中的明细列表
  const activeCartItems: Array<{ sectionName: string; pkg: any; qty: number; addons: Array<{ addon: any; qty: number }> }> = [];
  dbMealSections.forEach((sec: any) => {
    (sec.packages || []).forEach((pkg: any) => {
      const qty = matrixData[sec.name]?.[pkg.id] || 0;
      const selectedAddons = (pkg.addons || []).flatMap((addon: any) => {
        const addonQty = matrixAddons[sec.name]?.[pkg.id]?.[addon.id] || 0;
        return addonQty > 0 ? [{ addon, qty: addonQty }] : [];
      });
      if (qty > 0 || selectedAddons.length > 0) {
        activeCartItems.push({
          sectionName: sec.name,
          pkg: pkg,
          qty: qty,
          addons: selectedAddons,
        });
      }
    });
  });

  const activeItemsCount = activeCartItems.length;

  const liveWindowPhase = (() => {
    if (!orderWindow?.cutoff_at || !orderWindow?.grace_deadline) return orderWindow?.phase;
    const serverNow = Date.now() + serverClockOffset;
    if (serverNow < new Date(orderWindow.cutoff_at).getTime()) return 'open';
    if (serverNow <= new Date(orderWindow.grace_deadline).getTime()) return 'grace';
    return 'closed';
  })();

  const graceRemainingSeconds = (() => {
    if (!orderWindow?.grace_deadline) return 0;
    return Math.max(0, Math.floor((new Date(orderWindow.grace_deadline).getTime() - (Date.now() + serverClockOffset)) / 1000));
  })();

  const selectedDateBlocked = liveWindowPhase === 'closed'
    || (liveWindowPhase === 'grace' && !editSessionId)
    || orderWindow?.is_delivery_day_or_past;

  // 过滤得到在后台配置了套餐、允许显示在前端的餐次列表
  const visibleSections = dbMealSections.filter(sec => (sec.packages || []).length > 0).map(sec => sec.name);

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* 顶部渐变 Banner 面板 */}
      <div 
        style={{ 
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', 
          borderRadius: 20, 
          padding: '24px 32px', 
          color: '#ffffff',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          marginBottom: 24,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <Row align="middle" justify="space-between" gutter={[20, 20]}>
          <Col xs={24} md={14}>
            <Space orientation="vertical" size={2}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Title level={3} style={{ margin: 0, color: '#ffffff', fontWeight: 800, fontSize: 22, wordBreak: 'break-all' }}>{labels.title}</Title>
                <Tag color="success" style={{ borderRadius: 6, fontWeight: 'bold', border: 'none', background: '#10b981', color: '#fff' }}>{labels.fastMode}</Tag>
              </div>
              <Text style={{ color: '#94a3b8', fontSize: 14 }}>{labels.subtitle}</Text>
            </Space>
          </Col>
          
          <Col xs={24} md={10} style={{ textAlign: 'right' }}>
            <Space>
              {isYilian && !isSunday && !isBlocked && (
                <Button type="primary" onClick={handleQuickFillYilian} style={{ background: '#38bdf8', borderColor: '#38bdf8', color: '#0f172a', borderRadius: 8, height: 40, fontWeight: 'bold' }}>
                  {labels.quickFillYilian}
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </div>

      {/* 警告拦截 Banner */}
      <Alert
        title={labels.rulesTitle}
        description={labels.rulesDesc}
        type="info"
        showIcon
        style={{ marginBottom: 16, borderRadius: 12 }}
      />

      {accessStatus?.temporary_access_active && (
        <Alert
          title={labels.tempAccessTitle}
          description={isEn
            ? `Ordering is temporarily open until ${accessStatus.temporary_access_until}. Delivery dates are limited to ${accessStatus.max_order_delivery_date}. Confirmed orders remain valid after access expires.`
            : `下单权限临时开放至 ${accessStatus.temporary_access_until}；只可选择 ${accessStatus.max_order_delivery_date} 或之前的配送日期。权限到期后，已成功提交的订单仍然有效。`}
          type="warning"
          showIcon
          style={{ marginBottom: 16, borderRadius: 12 }}
        />
      )}

      {isBlocked && (
        <Alert
          title={labels.blockedTitle}
          description={`${labels.blockedDesc}${accessStatus?.overdue_amount ? ` ${isEn ? 'Overdue' : '到期欠款'}: RM ${Number(accessStatus.overdue_amount).toFixed(2)}` : ''}`}
          type="error"
          showIcon
          style={{ marginBottom: 24, borderRadius: 12 }}
        />
      )}

      {reduceOnly && (
        <Alert title={labels.reduceOnly} type="warning" showIcon style={{ marginBottom: 16, borderRadius: 12 }} />
      )}

      {liveWindowPhase === 'grace' && editSessionId && (
        <Alert
          title={labels.graceActive}
          description={`${Math.floor(graceRemainingSeconds / 60)}:${String(graceRemainingSeconds % 60).padStart(2, '0')}`}
          type="warning"
          showIcon
          style={{ marginBottom: 16, borderRadius: 12 }}
        />
      )}

      {selectedDateBlocked && (
        <Alert title={labels.cutoffClosed} type="error" showIcon style={{ marginBottom: 16, borderRadius: 12 }} />
      )}

      {isYilian && isSunday && (
        <Alert
          title={labels.sundayReminderTitle}
          description={labels.sundayReminderDesc}
          type="warning"
          showIcon
          style={{ marginBottom: 24, borderRadius: 12 }}
        />
      )}

      {/* 送餐信息选择栏 */}
      <div 
        style={{ 
          background: '#ffffff', 
          borderRadius: 16, 
          padding: '24px', 
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          border: '1px solid #f1f5f9',
          marginBottom: 24
        }}
      >
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Space orientation="vertical" style={{ width: '100%' }} size={6}>
              <Text strong style={{ fontSize: 14, color: '#334155' }}>{labels.deliveryDate}</Text>
              <DatePicker
                size="large"
                style={{ width: '100%', borderRadius: 10 }}
                value={dayjs(selectedDate)}
                onChange={(d) => {
                  if (!d) return;
                  setEditSessionId(null);
                  setOrderWindow(null);
                  setSelectedDate(d.format('YYYY-MM-DD'));
                }}
                allowClear={false}
                disabled={isEditing}
                disabledDate={(current) => {
                  if (!current) return false;
                  if (current.isSame(dayjs(), 'day') || current.isBefore(dayjs(), 'day')) return true;
                  if (accessStatus?.temporary_access_active && accessStatus?.max_order_delivery_date) {
                    return current.isAfter(dayjs(accessStatus.max_order_delivery_date), 'day');
                  }
                  return false;
                }}
              />
            </Space>
          </Col>
          
          <Col xs={24} sm={12} md={12} lg={8}>
            <Space orientation="vertical" style={{ width: '100%' }} size={6}>
              <Text strong style={{ fontSize: 14, color: '#334155' }}>{labels.deliverySite}</Text>
              <Select
                size="large"
                style={{ width: '100%', borderRadius: 10 }}
                value={selectedSiteId}
                onChange={(val) => setSelectedSiteId(val)}
                placeholder={labels.selectSitePlaceholder}
              >
                {sites.map((s) => (
                  <Option key={s.id} value={s.id}>{s.site_name}</Option>
                ))}
              </Select>
            </Space>
          </Col>
        </Row>
      </div>

      {/* 主操作区域 */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <Text strong style={{ fontSize: 18, color: '#0f172a' }}>{labels.orderPageTitle}</Text>
              <div style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>{labels.orderPageDesc}</div>
            </div>
          </div>

          {visibleSections.length === 0 ? (
            <Card style={{ borderRadius: 16, textAlign: 'center', padding: '40px 24px' }}>
              <Empty description={labels.emptyPackages} />
            </Card>
          ) : (
            <Row gutter={[16, 16]}>
              {visibleSections.map((sectionName) => {
                const sectionPkgs = getAvailablePackagesForSection(sectionName);
                const sectionPkgMap = matrixData[sectionName] || {};
                const sectionTotalQty = Object.values(sectionPkgMap).reduce((a, b) => a + (b || 0), 0);
                const isSelected = sectionTotalQty > 0;
                
                return (
                  <Col xs={24} sm={12} key={sectionName}>
                    <Card
                      style={{
                        borderRadius: 16,
                        border: isSelected ? '2px solid #10b981' : '1px solid #e2e8f0',
                        boxShadow: isSelected ? '0 10px 20px rgba(16,185,129,0.06)' : '0 4px 6px rgba(0,0,0,0.01)',
                        background: isSelected ? '#f0fdf4' : '#ffffff',
                        overflow: 'hidden',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                      styles={{ body: { padding: 20 } }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
                        <div>
                          <Text strong style={{ fontSize: 16, color: '#0f172a', display: 'block' }}>{translateMealSection(sectionName)}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>{sectionTotalQty > 0 ? `${labels.orderedCount} ${sectionTotalQty} ${labels.portions}` : labels.noOrder}</Text>
                        </div>
                        
                        {isSelected && (
                          <Badge status="success" text={<Text strong style={{ color: '#10b981', fontSize: 12 }}>{labels.selected}</Text>} />
                        )}
                      </div>

                      {/* 展示该餐次下允许的所有套餐供客人分别独立加减数量 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {sectionPkgs.map((pkg: any) => {
                          const qty = matrixData[sectionName]?.[pkg.id] || 0;
                          const packageAddons = pkg.addons || [];
                          
                          const updatePkgQty = (newVal: number) => {
                            const maximum = originalMatrixData[sectionName]?.[pkg.id] ?? 0;
                            const safeValue = reduceOnly ? Math.min(maximum, newVal) : newVal;
                            setMatrixData(prev => ({
                              ...prev,
                              [sectionName]: {
                                ...(prev[sectionName] || {}),
                                [pkg.id]: Math.max(0, safeValue)
                              }
                            }));
                          };

                          const updateAddonQty = (addonId: number, newVal: number) => {
                            const maximum = originalMatrixAddons[sectionName]?.[pkg.id]?.[addonId] ?? 0;
                            const safeValue = reduceOnly ? Math.min(maximum, newVal) : newVal;
                            setMatrixAddons(prev => ({
                              ...prev,
                              [sectionName]: {
                                ...(prev[sectionName] || {}),
                                [pkg.id]: {
                                  ...(prev[sectionName]?.[pkg.id] || {}),
                                  [addonId]: Math.max(0, safeValue),
                                },
                              }
                            }));
                          };

                          return (
                            <div 
                              key={pkg.id} 
                              style={{ 
                                background: qty > 0 ? '#ffffff' : '#f8fafc', 
                                border: qty > 0 ? '1px solid #10b981' : '1px solid #e2e8f0', 
                                borderRadius: 12, 
                                padding: 12 
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
                                  <Text strong style={{ fontSize: 14, color: '#1e293b', display: 'block' }}>
                                    {translatePackageTemplateName(pkg.name)}
                                  </Text>
                                  <Tag color="blue" style={{ fontSize: 11, marginTop: 2 }}>{pkg.category}</Tag>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '2px 4px', borderRadius: 20 }}>
                                  <Button
                                    type="text"
                                    shape="circle"
                                    size="small"
                                    disabled={qty <= 0 || (isBlocked && !isEditing) || (isYilian && isSunday)}
                                    icon={<MinusOutlined style={{ fontSize: 11, color: qty > 0 ? '#0f172a' : '#94a3b8' }} />}
                                    onClick={() => updatePkgQty(qty - 1)}
                                    style={{ width: 26, height: 26, background: qty > 0 ? '#ffffff' : 'transparent', boxShadow: qty > 0 ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
                                  />
                                  
                                  <InputNumber
                                    min={0}
                                    max={reduceOnly ? (originalMatrixData[sectionName]?.[pkg.id] ?? 0) : 9999}
                                    variant="borderless"
                                    controls={false}
                                    value={qty}
                                    onChange={(val) => updatePkgQty(val || 0)}
                                    disabled={(isBlocked && !isEditing) || (isYilian && isSunday)}
                                    style={{ width: 44, textAlign: 'center', fontWeight: 'bold', fontSize: 14, background: 'transparent' }}
                                  />
                                  
                                  <Button
                                    type="text"
                                    shape="circle"
                                    size="small"
                                    disabled={isBlocked || (isYilian && isSunday)}
                                    icon={<PlusOutlined style={{ fontSize: 11, color: '#0f172a' }} />}
                                    onClick={() => updatePkgQty(qty + 1)}
                                    style={{ width: 26, height: 26, background: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                                  />
                                </div>
                              </div>

                              {packageAddons.map((addon: any) => {
                                const addonQty = matrixAddons[sectionName]?.[pkg.id]?.[addon.id] || 0;
                                return (
                                  <div key={addon.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #e2e8f0', paddingTop: 6, marginTop: 6 }}>
                                    <div>
                                      <Text style={{ fontSize: 12, color: '#64748b' }}>{addon.name}</Text>
                                      <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>RM {Number(addon.price || 0).toFixed(2)}</Text>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '2px 4px', borderRadius: 20 }}>
                                      <Button type="text" shape="circle" size="small" disabled={addonQty <= 0 || (isBlocked && !isEditing) || (isYilian && isSunday)} icon={<MinusOutlined style={{ fontSize: 9 }} />} onClick={() => updateAddonQty(addon.id, addonQty - 1)} style={{ width: 22, height: 22 }} />
                                      <InputNumber min={0} max={reduceOnly ? (originalMatrixAddons[sectionName]?.[pkg.id]?.[addon.id] ?? 0) : 999} variant="borderless" controls={false} value={addonQty} onChange={(val) => updateAddonQty(addon.id, val || 0)} disabled={(isBlocked && !isEditing) || (isYilian && isSunday)} style={{ width: 32, textAlign: 'center', fontWeight: 'bold', fontSize: 12, background: 'transparent' }} />
                                      <Button type="text" shape="circle" size="small" disabled={isBlocked || (isYilian && isSunday)} icon={<PlusOutlined style={{ fontSize: 9 }} />} onClick={() => updateAddonQty(addon.id, addonQty + 1)} style={{ width: 22, height: 22, background: '#fff' }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          )}
        </Col>

        {/* 右侧：购物车 */}
        <Col xs={24} lg={8}>
          <div
            style={{
              background: '#ffffff',
              borderRadius: 20,
              boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
              border: '1px solid #e2e8f0',
              padding: '24px',
              position: 'sticky',
              top: 24
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Text strong style={{ fontSize: 16, color: '#0f172a' }}>{labels.orderSummary}</Text>
              </div>
              {activeItemsCount > 0 && !reduceOnly && (
                <Button type="link" danger size="small" onClick={handleClearOrder} style={{ padding: 0 }}>
                  {labels.clearAll}
                </Button>
              )}
            </div>

            <Divider style={{ margin: '0 0 20px 0' }} />

            {activeItemsCount === 0 ? (
              <div style={{ padding: '48px 0', textAlign: 'center', background: '#f8fafc', borderRadius: 16, marginBottom: 20, border: '1px dashed #cbd5e1' }}>
                <Text type="secondary" style={{ display: 'block', fontWeight: 'bold' }}>{labels.emptyCartTitle}</Text>
                <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>{labels.emptyCartDesc}</Text>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
                {activeCartItems.map((item, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      gap: 6,
                      background: '#f8fafc', 
                      padding: '12px 14px', 
                      borderRadius: 12, 
                      border: '1px solid #f1f5f9' 
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <Text strong style={{ fontSize: 14, color: '#1e293b' }}>{translateMealSection(item.sectionName)}</Text>
                        </div>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', color: '#64748b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {translatePackageTemplateName(item.pkg.name)}
                        </Text>
                      </div>
                      <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 'bold', minWidth: 60, textAlign: 'center' }}>
                        {item.qty > 0 ? `${item.qty} ${labels.pax}` : (isEn ? 'Add-on only' : '仅附加项')}
                      </span>
                    </div>

                    {item.addons.map(({ addon, qty: addonQty }) => (
                      <div key={addon.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '3px 8px' }}>
                        <Text style={{ fontSize: 12, color: '#b45309' }}>{addon.name}</Text>
                        <Text strong style={{ fontSize: 12, color: '#b45309' }}>+{addonQty} {labels.portions}</Text>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8, color: '#334155' }}>
                {labels.remarkTitle}
              </Text>
              <Input.TextArea
                rows={3}
                placeholder={labels.remarkPlaceholder}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                style={{ borderRadius: 10, border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', padding: '16px', borderRadius: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text type="secondary" style={{ fontSize: 13 }}>{labels.factory}</Text>
                <Text strong style={{ color: '#0f172a', fontSize: 13 }} ellipsis={{ tooltip: true }}>
                  {sites.find(s => s.id === selectedSiteId)?.site_name || labels.notSpecified}
                </Text>
              </div>
              <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text type="secondary" style={{ fontSize: 13 }}>{labels.deliveryDate}</Text>
                <Text strong style={{ color: '#0f172a', fontSize: 13 }}>{selectedDate}</Text>
              </div>
              
              <Divider style={{ margin: '12px 0', borderStyle: 'dashed' }} />
              
              <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ fontSize: 15, color: '#0f172a' }}>{labels.totalPax}</Text>
                <Text strong style={{ fontSize: 24, color: '#10b981' }}>{totalPortions} {labels.pax}</Text>
              </div>
            </div>

            <Button
              type="primary"
              size="large"
              block
              loading={submitting}
              disabled={(isBlocked && !isEditing) || selectedDateBlocked || (isYilian && isSunday) || totalPortions === 0}
              onClick={handleSubmitOrder}
              style={{
                height: 52,
                fontSize: 16,
                fontWeight: 'bold',
                borderRadius: 12,
                background: (isBlocked && !isEditing) || selectedDateBlocked || totalPortions === 0 ? '#cbd5e1' : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                borderColor: 'transparent'
              }}
            >
              {isBlocked && !isEditing ? labels.btnLocked : labels.btnSubmit}
            </Button>
          </div>
        </Col>
      </Row>
    </div>
  );
};
