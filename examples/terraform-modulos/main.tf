provider "aws" {
  region                      = "us-east-1"
  access_key                  = "mock"
  secret_key                  = "mock"
  skip_credentials_validation = true
  skip_requesting_account_id  = true
  skip_metadata_api_check     = true
}

resource "aws_vpc" "main" { cidr_block = "10.0.0.0/16" }

module "red" {
  source = "./modules/red"
  vpc_id = aws_vpc.main.id
}

resource "aws_instance" "web" {
  for_each      = toset(["a", "b"])
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.micro"
  subnet_id     = module.red.subnet_id
}