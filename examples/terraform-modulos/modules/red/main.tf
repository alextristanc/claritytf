variable "vpc_id" { type = string }

resource "aws_subnet" "a" {
  count      = 2
  vpc_id     = var.vpc_id
  cidr_block = "10.0.${count.index}.0/24"
}

module "seguridad" {
  source = "../seguridad"
  vpc_id = var.vpc_id
}

output "subnet_id" { value = aws_subnet.a[0].id }