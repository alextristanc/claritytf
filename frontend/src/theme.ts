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
// Las rutas son absolutas desde `public/` para que funcionen tanto en la
// app como en exportaciones SVG/PNG (punto 2 del roadmap).
//
// Estructura preparada para Option B: basta con llenar cada mapa de
// proveedor con todos los tipos y añadir nuevos proveedores sin tocar
// Graph.tsx ni App.tsx.
export const LOGOS_BY_PROVIDER: Record<string, Record<string, string>> = {
  aws: {
    'aws_s3_bucket': './public/logos/aws/s3.svg',
    'aws_iam_role': './public/logos/aws/iam.svg',
    'aws_iam_role_policy_attachment': './public/logos/aws/iam.svg',
    'aws_instance': './public/logos/aws/ec2.svg',
    'aws_eip': './public/logos/aws/ec2.svg',
    'aws_db_instance': './public/logos/aws/rds.svg',
    'aws_vpc': './public/logos/aws/vpc.svg',
    'aws_subnet': './public/logos/aws/subnet.svg',
    'aws_security_group': './public/logos/aws/securitygroup.svg',
    'aws_security_group_rule': './public/logos/aws/securitygroup.svg',
    'aws_lambda': './public/logos/aws/lambda.svg',
    'aws_eks_cluster': './public/logos/aws/eks.svg',
    'aws_eks': './public/logos/aws/eks.svg',
    'aws_cloudfront_distribution': './public/logos/aws/cloudfront.svg',
    'aws_kinesis_stream': './public/logos/aws/kinesis.svg',
  },
  azure: {},
  gcp: {},
};

// Logo genérico por proveedor cuando no hay uno específico para el tipo.
export const DEFAULT_LOGO_BY_PROVIDER: Record<string, string> = {
  aws: '/logos/aws/default.svg',
  azure: '/logos/aws/default.svg',
  gcp: '/logos/aws/default.svg',
};

// Logo genérico cuando no se reconoce el proveedor.
export const DEFAULT_LOGO = '/logos/aws/default.svg';

// Devuelve la ruta del logo para un tipo de recurso Terraform.
// Extrae el proveedor del prefijo del tipo (p. ej. `aws` de `aws_s3_bucket`).
export function logoForResource(type: string): string {
  const provider = type.split('_')[0];
  return LOGOS_BY_PROVIDER[provider]?.[type]
    ?? DEFAULT_LOGO_BY_PROVIDER[provider]
    ?? DEFAULT_LOGO;
}
