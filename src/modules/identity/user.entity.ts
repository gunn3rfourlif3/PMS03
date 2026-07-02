import {
  Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ nullable: true }) name?: string;
  @Index({ unique: true }) @Column({ nullable: true }) email?: string;
  @Index() @Column({ nullable: true }) phone?: string; // passwordless OTP target
  @Column({ default: 'active' }) status: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
