import type { Action } from './types';

// Colores por acción: acentos vivos sobre fondo oscuro. Se usan como borde/glow
// de los nodos y como fondo de las insignias de la leyenda y del panel.
export const COLORS: Record<Action, string> = {
  create: '#6ee7b7',
  update: '#fcd34d',
  delete: '#fca5a5',
  replace: '#fdba74',
  'no-op': '#93c5fd',
  mixed: '#cbd5e1',
};

// Etiquetas en español usadas en la leyenda y en el panel de detalles.
export const LABELS: Record<Action, string> = {
  create: 'Crear', update: 'Actualizar', delete: 'Eliminar',
  replace: 'Reemplazar', 'no-op': 'Sin cambios', mixed: 'Mixto',
};

// Glifo propio para las acciones que no se distinguen solo por color.
export const GLYPHS: Partial<Record<Action, string>> = {
  mixed: '◆',
};

// Logos agrupados por proveedor. La clave exterior es el prefijo del tipo
// de recurso Terraform (`aws`, `azurerm`, `google`, …). La clave interior
// es el valor completo de `node.type` (p. ej. `aws_s3_bucket`).
//
// Las rutas se construyen con BASE_URL de Vite para que funcionen tanto en
// desarrollo como en GitHub Pages (donde la app se sirve bajo el `base` de
// vite.config.ts, p. ej. `/claritytf/`).
//
// Estructura preparada para Option B: basta con llenar cada mapa de
// proveedor con todos los tipos y añadir nuevos proveedores sin tocar
// Graph.tsx ni App.tsx.
const BASE_URL: string = (import.meta.env as { BASE_URL?: string }).BASE_URL ?? '/';

export const LOGOS_BY_PROVIDER: Record<string, Record<string, string>> = {
  aws: {
    'aws_s3_bucket': `${BASE_URL}logos/aws/s3.svg`,
    'aws_iam_role': `${BASE_URL}logos/aws/iam.svg`,
    'aws_iam_role_policy_attachment': `${BASE_URL}logos/aws/iam.svg`,
    'aws_instance': `${BASE_URL}logos/aws/ec2.svg`,
    'aws_eip': `${BASE_URL}logos/aws/ec2.svg`,
    'aws_db_instance': `${BASE_URL}logos/aws/rds.svg`,
    'aws_vpc': `${BASE_URL}logos/aws/vpc.svg`,
    'aws_subnet': `${BASE_URL}logos/aws/subnet.svg`,
    'aws_security_group': `${BASE_URL}logos/aws/securitygroup.svg`,
    'aws_security_group_rule': `${BASE_URL}logos/aws/securitygroup.svg`,
    'aws_lambda': `${BASE_URL}logos/aws/lambda.svg`,
    'aws_eks_cluster': `${BASE_URL}logos/aws/eks.svg`,
    'aws_eks': `${BASE_URL}logos/aws/eks.svg`,
    'aws_cloudfront_distribution': `${BASE_URL}logos/aws/cloudfront.svg`,
    'aws_kinesis_stream': `${BASE_URL}logos/aws/kinesis.svg`,
  },
  azure: {},
  gcp: {},
};

// Logo genérico por proveedor cuando no hay uno específico para el tipo.
export const DEFAULT_LOGO_BY_PROVIDER: Record<string, string> = {
  aws: `${BASE_URL}logos/aws/default.svg`,
  azure: `${BASE_URL}logos/aws/default.svg`,
  gcp: `${BASE_URL}logos/aws/default.svg`,
};

// Logo genérico cuando no se reconoce el proveedor.
export const DEFAULT_LOGO = `${BASE_URL}logos/aws/default.svg`;

// Devuelve la ruta del logo para un tipo de recurso Terraform.
// Extrae el proveedor del prefijo del tipo (p. ej. `aws` de `aws_s3_bucket`).
export function logoForResource(type: string): string {
  const provider = type.split('_')[0];
  return LOGOS_BY_PROVIDER[provider]?.[type]
    ?? DEFAULT_LOGO_BY_PROVIDER[provider]
    ?? DEFAULT_LOGO;
}
