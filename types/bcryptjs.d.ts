declare module "bcryptjs" {
  export function genSaltSync(rounds?: number): string;
  export function hashSync(value: string, salt: string | number): string;
  export function compareSync(value: string, hash: string): boolean;
}
