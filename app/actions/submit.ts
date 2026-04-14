"use server";

// 도메인별로 분리된 서버 액션 재수출 (기존 import 경로 호환)

// ── 생산·공장운영 ──
export {
  submitProductionLog,
  submitHygieneCheck,
  submitClaim,
  submitWorkOrder,
  submitHeadWorkLog,
  submitProductionPlan,
  submitLivestockIntake,
  submitWaterUsage,
  submitUtilityLog,
  submitMaintenanceLog,
} from "./production";

// ── 재고 관리 ──
export {
  saveFrozenInventory,
  updateFrozenInventoryRow,
  submitContainerInventory,
} from "./inventory";

// ── 재무·회계 ──
export {
  saveMonthlyKpi,
  saveCostApproval,
  approveCostRequest,
  submitCostApprovalRequest,
  recordMaterialPurchase,
  updatePurchaseRemaining,
  recordPurchasePayment,
  recordCashFlow,
} from "./finance";

// ── 인사·급여 ──
export {
  createStaffMember,
  toggleMemberActive,
  resetMemberPassword,
  saveStaffSalary,
  savePayrollMonth,
  bulkUpdateBaseSalaries,
} from "./hr";

// ── 영업·납품 ──
export {
  submitDelivery,
  saveCustomer,
} from "./sales";

// ── 보고·브리핑 ──
export {
  submitDeptReport,
  submitBriefing,
  updateBriefing,
  deleteBriefing,
  toggleBriefingPin,
  saveCooComment,
} from "./reporting";

// ── 품질·클레임 ──
export {
  submitQualityPatrol,
  submitAuditChecklist,
  updateClaimStatus,
  updateClaimDetails,
  fetchClaimTraceability,
} from "./quality";
