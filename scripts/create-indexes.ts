import { connectDB } from "../lib/mongodb"
import { Task } from "../models/Task"
import { Project } from "../models/Project"
import { Member } from "../models/Member"
import { SupportRequest } from "../models/SupportRequest"

async function main() {
  await connectDB()
  console.log("Creating indexes...")

  await Task.collection.createIndex({ projectId: 1 })
  await Task.collection.createIndex({ status: 1 })
  await Task.collection.createIndex({ slackThreadTs: 1 })
  await Task.collection.createIndex({ assignee: 1 })
  await Task.collection.createIndex({ deadline: 1 })
  await Task.collection.createIndex({ projectId: 1, status: 1 })

  await Project.collection.createIndex({ name: 1 })
  await Project.collection.createIndex({ status: 1 })

  await Member.collection.createIndex({ slackUserId: 1 })
  await Member.collection.createIndex({ name: 1 })
  await Member.collection.createIndex({ email: 1 })

  await SupportRequest.collection.createIndex({ submitterEmail: 1, createdAt: -1 })
  await SupportRequest.collection.createIndex({ status: 1 })
  await SupportRequest.collection.createIndex({ source: 1 })
  await SupportRequest.collection.createIndex({ linkedTaskId: 1 })
  await SupportRequest.collection.createIndex({ slackThreadTs: 1 })
  await SupportRequest.collection.createIndex({ createdAt: -1 })

  console.log("All indexes created successfully")
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
