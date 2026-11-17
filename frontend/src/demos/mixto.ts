import type { GraphModel } from '../types';

// Modelo sintético: no proviene de `terraform show` sino que se escribió a mano
// para la demo. Mezcla las cinco acciones, módulos anidados y for_each.
const mixto: GraphModel = {
  schemaVersion: 1,
  nodes: [
    {
      id: 'aws_s3_bucket.logs',
      type: 'aws_s3_bucket',
      name: 'logs',
      module: null,
      action: 'create',
      values: {
        bucket: 'claritytf-logs-demo',
        force_destroy: false,
        tags: { Entorno: 'demo' },
      },
    },
    {
      id: 'aws_iam_role.app',
      type: 'aws_iam_role',
      name: 'app',
      module: null,
      action: 'no-op',
      values: {
        name: 'claritytf-app',
        path: '/',
        assume_role_policy: '{"Version":"2012-10-17","Statement":[...]}',
      },
    },
    {
      id: 'aws_iam_role_policy_attachment.app',
      type: 'aws_iam_role_policy_attachment',
      name: 'app',
      module: null,
      action: 'create',
      values: {
        role: 'claritytf-app',
        policy_arn: 'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess',
      },
    },
    {
      id: 'aws_instance.web["a"]',
      type: 'aws_instance',
      name: 'web["a"]',
      module: null,
      action: 'create',
      values: {
        ami: 'ami-0abcdef1234567890',
        instance_type: 't3.micro',
        subnet_id: 'subnet-a',
        tags: { Nombre: 'web-a' },
      },
    },
    {
      id: 'aws_instance.web["b"]',
      type: 'aws_instance',
      name: 'web["b"]',
      module: null,
      action: 'update',
      values: {
        ami: 'ami-0abcdef1234567890',
        instance_type: 't3.small',
        subnet_id: 'subnet-b',
        tags: { Nombre: 'web-b' },
      },
    },
    {
      id: 'aws_eip.web',
      type: 'aws_eip',
      name: 'web',
      module: null,
      action: 'replace',
      values: {
        domain: 'vpc',
        instance: 'i-0a1b2c3d4e5f',
      },
    },
    {
      id: 'aws_db_instance.primary',
      type: 'aws_db_instance',
      name: 'primary',
      module: null,
      action: 'replace',
      values: {
        engine: 'postgres',
        engine_version: '16.3',
        instance_class: 'db.t4g.micro',
        allocated_storage: 20,
        storage_encrypted: true,
      },
    },
    {
      id: 'module.red.aws_vpc.main',
      type: 'aws_vpc',
      name: 'main',
      module: 'module.red',
      action: 'no-op',
      values: {
        cidr_block: '10.0.0.0/16',
        enable_dns_support: true,
        tags: { Nombre: 'red-demo' },
      },
    },
    {
      id: 'module.red.aws_subnet.a',
      type: 'aws_subnet',
      name: 'a',
      module: 'module.red',
      action: 'create',
      values: {
        cidr_block: '10.0.1.0/24',
        vpc_id: 'vpc-demo',
        map_public_ip_on_launch: true,
      },
    },
    {
      id: 'module.red.aws_subnet.b',
      type: 'aws_subnet',
      name: 'b',
      module: 'module.red',
      action: 'delete',
      values: {
        cidr_block: '10.0.2.0/24',
        vpc_id: 'vpc-demo',
        map_public_ip_on_launch: false,
      },
    },
    {
      id: 'module.red.module.seguridad.aws_security_group.web',
      type: 'aws_security_group',
      name: 'web',
      module: 'module.red.module.seguridad',
      action: 'update',
      values: {
        name: 'web-demo',
        vpc_id: 'vpc-demo',
        description: 'Acceso HTTP/HTTPS',
      },
    },
    {
      id: 'module.red.module.seguridad.aws_security_group_rule.ingress',
      type: 'aws_security_group_rule',
      name: 'ingress',
      module: 'module.red.module.seguridad',
      action: 'create',
      values: {
        type: 'ingress',
        from_port: 443,
        to_port: 443,
        protocol: 'tcp',
        cidr_blocks: ['0.0.0.0/0'],
      },
    },
    {
      id: 'module.red.module.seguridad.aws_security_group_rule.egress',
      type: 'aws_security_group_rule',
      name: 'egress',
      module: 'module.red.module.seguridad',
      action: 'delete',
      values: {
        type: 'egress',
        from_port: 0,
        to_port: 0,
        protocol: '-1',
      },
    },
  ],
  edges: [
    { from: 'module.red.aws_vpc.main', to: 'module.red.aws_subnet.a' },
    { from: 'module.red.aws_vpc.main', to: 'module.red.aws_subnet.b' },
    { from: 'module.red.aws_subnet.a', to: 'module.red.module.seguridad.aws_security_group.web' },
    { from: 'module.red.aws_subnet.b', to: 'aws_db_instance.primary' },
    { from: 'module.red.module.seguridad.aws_security_group.web', to: 'module.red.module.seguridad.aws_security_group_rule.ingress' },
    { from: 'module.red.module.seguridad.aws_security_group.web', to: 'module.red.module.seguridad.aws_security_group_rule.egress' },
    { from: 'module.red.module.seguridad.aws_security_group_rule.ingress', to: 'aws_instance.web["a"]' },
    { from: 'module.red.module.seguridad.aws_security_group_rule.ingress', to: 'aws_instance.web["b"]' },
    { from: 'aws_iam_role.app', to: 'aws_iam_role_policy_attachment.app' },
    { from: 'aws_iam_role_policy_attachment.app', to: 'aws_instance.web["a"]' },
    { from: 'aws_s3_bucket.logs', to: 'aws_iam_role_policy_attachment.app' },
    { from: 'aws_instance.web["a"]', to: 'aws_eip.web' },
  ],
  modules: [
    { id: 'module.red', parent: null },
    { id: 'module.red.module.seguridad', parent: 'module.red' },
  ],
  warnings: [
    'Se ignoró una referencia a data.aws_ami.ubuntu: los data sources no generan aristas.',
  ],
};

export default mixto;
