use App\Models\Account;
use Illuminate\Database\Eloquent\Builder;
use Tally\Laravel\Grid;

final class AccountsGrid extends Grid
{
    public function query(): Builder
    {
        return Account::query()->whereBelongsTo(auth()->user()->team);
    }

    public function columns(): array
    {
        return [
            ['id' => 'account', 'label' => 'Account'],
            ['id' => 'plan', 'type' => 'enum', 'options' => [['value' => 'free'], ['value' => 'pro'], ['value' => 'team']]],
            ['id' => 'mrr', 'label' => 'MRR', 'type' => 'currency', 'aggregate' => 'sum'],
            ['id' => 'renewal', 'type' => 'date'],
        ];
    }
}
