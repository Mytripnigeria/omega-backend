import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { StoreModule } from './modules/store/store.module';
import { AdminModule } from './modules/admin/admin.module';
import { RolesModule } from './modules/roles/roles.module';
import { StaffModule } from './modules/staff/staff.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { PayslipsModule } from './modules/payslips/payslips.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { IngredientsModule } from './modules/ingredients/ingredients.module';
import { VariationGroupsModule } from './modules/variation-groups/variation-groups.module';
import { AddOnGroupsModule } from './modules/addon-groups/addon-groups.module';
import { ProductsModule } from './modules/products/products.module';
import { CombosModule } from './modules/combos/combos.module';
import { StorageModule } from './modules/storage/storage.module';
import { BusinessModule } from './modules/business/business.module';
import { TaxRatesModule } from './modules/tax-rates/tax-rates.module';
import { PaymentMethodsModule } from './modules/payment-methods/payment-methods.module';
import { PrintersModule } from './modules/printers/printers.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { DomainsModule } from './modules/domains/domains.module';
import { NotificationPreferencesModule } from './modules/notification-preferences/notification-preferences.module';
import { ActivityLogModule } from './modules/activity-log/activity-log.module';
import { OrdersModule } from './modules/orders/orders.module';
import { DeliveriesModule } from './modules/deliveries/deliveries.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { ReportsModule } from './modules/reports/reports.module';
import { WorkstationSettingsModule } from './modules/workstation-settings/workstation-settings.module';
import { UsersModule } from './modules/users/users.module';
import { CustomersModule } from './modules/customers/customers.module';
import { InventoryLocationsModule } from './modules/inventory-locations/inventory-locations.module';
import { StockTransfersModule } from './modules/stock-transfers/stock-transfers.module';
import { EquipmentModule } from './modules/equipment/equipment.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    DatabaseModule,
    BusinessModule,
    AuthModule,
    StoreModule,
    AdminModule,
    RolesModule,
    StaffModule,
    ShiftsModule,
    PayslipsModule,
    CategoriesModule,
    IngredientsModule,
    VariationGroupsModule,
    AddOnGroupsModule,
    ProductsModule,
    CombosModule,
    StorageModule,
    TaxRatesModule,
    PaymentMethodsModule,
    PrintersModule,
    WebhooksModule,
    DomainsModule,
    NotificationPreferencesModule,
    ActivityLogModule,
    OrdersModule,
    DeliveriesModule,
    ExpensesModule,
    ReportsModule,
    WorkstationSettingsModule,
    UsersModule,
    CustomersModule,
    InventoryLocationsModule,
    StockTransfersModule,
    EquipmentModule,
    SuppliersModule,
  ],
})
export class AppModule {}
