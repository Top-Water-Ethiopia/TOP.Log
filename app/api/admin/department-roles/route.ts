import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function redirectToDepartmentProfessions(request: Request) {
  const url = new URL(request.url)
  url.pathname = "/api/admin/department-professions"
  return NextResponse.redirect(url, 307)
}

export async function GET(request: Request) {
  return redirectToDepartmentProfessions(request)
}

export async function POST(request: Request) {
  return redirectToDepartmentProfessions(request)
}

export async function PUT(request: Request) {
  return redirectToDepartmentProfessions(request)
}

export async function DELETE(request: Request) {
  return redirectToDepartmentProfessions(request)
}
