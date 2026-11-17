variable "vpc_id" { type = string }
variable "index" { type = number }

resource "aws_subnet" "b" {
  vpc_id     = var.vpc_id
  cidr_block = "10.0.1${var.index}.0/24"
}
