import { PMSInterface } from './pms-interface.ts'
import { CareStackAdapter } from './carestack-adapter.ts'
import { DentrixAdapter } from './dentrix-adapter.ts'
import { EaglesoftAdapter } from './eaglesoft-adapter.ts'

export class PMSFactory {
  static createAdapter(pmsType: string, credentials: any): PMSInterface {
    switch (pmsType.toLowerCase()) {
      case 'carestack':
        return new CareStackAdapter(credentials)
      case 'dentrix':
        return new DentrixAdapter(credentials)
      case 'eaglesoft':
        return new EaglesoftAdapter(credentials)
      default:
        throw new Error(`Unsupported PMS type: ${pmsType}`)
    }
  }
}