export class BaseSendBird {
  protected basePath: string;
  protected headers: Record<string, string>;

  protected appId: string;
  protected appToken: string;

  protected suffix = {
    users: 'users',
    groupChannels: 'group_channels',
  };

  async onModuleInit(): Promise<void> {
    this.basePath = `https://api-${this.appId}.sendbird.com/v3/`;
    this.headers = { 'Api-Token': this.appToken };
  }
}
