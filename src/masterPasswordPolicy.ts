export const MASTER_PASSWORD_RECOVERY_WARNING =
  '请牢记你的主密码。我们的任何数据都不会上传云端，因此你无法联系我们从而找回你的主密码。';

export const EMPTY_MASTER_PASSWORD_WARNING =
  '当前正在使用空主密码登录。虽然可以进入密码库，但有一定的风险；如果要确保安全，请及时设置主密码。';

export function shouldWarnAboutEmptyMasterPassword(masterPassword: string): boolean {
  return masterPassword.length === 0;
}
